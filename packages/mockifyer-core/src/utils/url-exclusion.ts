/**
 * Default excluded URLs that should never be recorded or mocked
 */
export const DEFAULT_EXCLUDED_URLS = [
  '/mockifyer-save',
  '/mockifyer-clear',
  '/mockifyer-sync',
  'api.resend.com'
];

/**
 * Checks if a URL should be excluded from recording/mocking based on the exclusion list
 * @param url The URL to check
 * @param excludedUrls Array of URL patterns to exclude (supports partial matches)
 * @returns true if the URL should be excluded, false otherwise
 */
export function shouldExcludeUrl(url: string | null | undefined, excludedUrls?: string[]): boolean {
  if (!url) {
    return false;
  }

  const exclusionList = excludedUrls && excludedUrls.length > 0 
    ? excludedUrls 
    : DEFAULT_EXCLUDED_URLS;

  return exclusionList.some(pattern => url.includes(pattern));
}


