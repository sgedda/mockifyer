import {
  capturePresentation,
  isAtlasEnabled,
  type AtlasCmsNode,
  type AtlasDatasourceRef,
} from './atlas';

export interface CmsRenderContext {
  pageId: string;
  pageSlug?: string;
  path: string;
  parentId?: string | null;
}

export interface CmsNodeResolveResult<TProps = Record<string, unknown>> {
  props: TProps;
  datasources?: AtlasDatasourceRef[];
  dataRoot?: string;
}

/**
 * Adapters for a CMS-like tree. App supplies node shape + props building;
 * the engine handles recursion and atlas capture.
 */
export interface CmsAtlasAdapters<TNode, TProps = Record<string, unknown>> {
  getNodeId(node: TNode): string;
  getNodeType(node: TNode): string;
  getChildren(node: TNode): TNode[];
  /**
   * Build props for this node. When atlas is on, prefer reading datasources via
   * {@link createCacheRegistry}'s `getCache` so access is tracked automatically.
   */
  buildProps(node: TNode, context: CmsRenderContext): CmsNodeResolveResult<TProps> | TProps;
  /** Optional label for atlas UI. */
  getLabel?(node: TNode): string | undefined;
}

function normalizeResolveResult<TProps>(
  result: CmsNodeResolveResult<TProps> | TProps
): CmsNodeResolveResult<TProps> {
  if (
    result &&
    typeof result === 'object' &&
    'props' in (result as object) &&
    (result as CmsNodeResolveResult<TProps>).props !== undefined
  ) {
    return result as CmsNodeResolveResult<TProps>;
  }
  return { props: result as TProps };
}

/**
 * Creates a generic CMS renderer: one recursive entry for the CMS tree.
 * Call `renderCmsNode` only for CMS nodes — not for nested React children.
 */
export function createCmsRenderer<TNode, TProps = Record<string, unknown>>(
  adapters: CmsAtlasAdapters<TNode, TProps>
) {
  function resolveNodeData(
    node: TNode,
    context: CmsRenderContext
  ): CmsNodeResolveResult<TProps> & { atlasCms: AtlasCmsNode } {
    const resolved = normalizeResolveResult(adapters.buildProps(node, context));
    const atlasCms: AtlasCmsNode = {
      pageId: context.pageId,
      pageSlug: context.pageSlug,
      nodeId: adapters.getNodeId(node),
      type: adapters.getNodeType(node),
      path: context.path,
      parentId: context.parentId ?? null,
      source: 'cms',
      label: adapters.getLabel?.(node),
    };
    return { ...resolved, atlasCms };
  }

  /**
   * Resolve props and capture presentation when atlas is enabled.
   * Returns props for the app to pass into its component map.
   */
  function resolveAndCapture(
    node: TNode,
    context: CmsRenderContext
  ): { props: TProps; datasources: AtlasDatasourceRef[] } {
    const { props, datasources, dataRoot, atlasCms } = resolveNodeData(node, context);
    const refs = [...(datasources ?? [])];
    if (dataRoot && refs.length === 1 && !refs[0].dataRoot) {
      refs[0] = { ...refs[0], dataRoot };
    }

    if (isAtlasEnabled()) {
      capturePresentation({
        cms: atlasCms,
        datasources: refs,
        shown: props,
      });
    }

    return { props, datasources: refs };
  }

  /**
   * Walk CMS children with updated path/parent context.
   */
  function mapChildren<T>(
    node: TNode,
    context: CmsRenderContext,
    mapFn: (child: TNode, childContext: CmsRenderContext, index: number) => T
  ): T[] {
    const children = adapters.getChildren(node) ?? [];
    return children.map((child, index) => {
      const childId = adapters.getNodeId(child);
      const childContext: CmsRenderContext = {
        ...context,
        parentId: adapters.getNodeId(node),
        path: `${context.path}/${childId || `children[${index}]`}`,
      };
      return mapFn(child, childContext, index);
    });
  }

  return {
    resolveNodeData,
    resolveAndCapture,
    mapChildren,
    getNodeId: adapters.getNodeId,
    getNodeType: adapters.getNodeType,
    getChildren: adapters.getChildren,
  };
}

export type CmsRenderer<TNode, TProps = Record<string, unknown>> = ReturnType<
  typeof createCmsRenderer<TNode, TProps>
>;
