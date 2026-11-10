/**
 * Gatsby Example: Using Mock Data in gatsby-node.ts
 * 
 * Place this code in your gatsby-node.ts file
 */

import { loadMockDataForBuild } from '@sgedda/mockifyer-core/utils/build-utils';
import path from 'path';

export async function sourceNodes({ actions, createNodeId, createContentDigest }: any) {
  const { createNode } = actions;
  const mockDataPath = path.join(__dirname, '../mock-data');

  const mockData = loadMockDataForBuild({
    mockDataPath,
    filter: (filename, data) => {
      // Only include GET requests
      return data.request.method === 'GET';
    },
    transform: (data) => {
      // Return clean data structure
      return {
        url: data.request.url,
        method: data.request.method,
        status: data.response.status,
        data: data.response.data,
        timestamp: data.timestamp
      };
    }
  });

  // Create Gatsby nodes from mock data
  mockData.data.forEach((item, index) => {
    const node = {
      id: createNodeId(`mock-data-${index}`),
      parent: null,
      children: [],
      ...item,
      internal: {
        type: 'MockData',
        contentDigest: createContentDigest(item),
        mediaType: 'application/json'
      }
    };
    createNode(node);
  });
}

export async function createPages({ graphql, actions }: any) {
  const { createPage } = actions;
  const mockDataPath = path.join(__dirname, '../mock-data');

  // Load posts data
  const postsData = loadMockDataForBuild({
    mockDataPath,
    filter: (filename, data) => {
      return data.request.method === 'GET' && 
             data.request.url.includes('/api/posts');
    },
    transform: (data) => data.response.data
  });

  // Create pages for each post
  postsData.data.forEach((post: any) => {
    createPage({
      path: `/posts/${post.id}`,
      component: path.resolve('./src/templates/post.tsx'),
      context: {
        postId: post.id,
        postData: post
      }
    });
  });
}

