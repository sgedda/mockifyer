/**
 * Next.js Example: Using Mock Data in getStaticProps
 * 
 * Place this in your Next.js pages directory or app directory
 */

import { loadMockDataForBuild } from '@sgedda/mockifyer-core/utils/build-utils';
import path from 'path';

// Example for pages/posts.tsx (Pages Router)
export async function getStaticProps() {
  const mockDataPath = path.join(process.cwd(), 'mock-data');
  
  const mockData = loadMockDataForBuild({
    mockDataPath,
    filter: (filename, data) => {
      // Only include GET requests to /api/posts
      return data.request.method === 'GET' && 
             data.request.url.includes('/api/posts');
    },
    transform: (data) => {
      // Extract only the response data
      return data.response.data;
    },
    includeMetadata: false // Don't include timestamp, etc. in props
  });

  return {
    props: {
      posts: mockData.data,
      totalPosts: mockData.count
    },
    // Revalidate every hour
    revalidate: 3600
  };
}

// Example for app/posts/page.tsx (App Router)
export async function generateStaticParams() {
  const mockDataPath = path.join(process.cwd(), 'mock-data');
  
  const mockData = loadMockDataForBuild({
    mockDataPath,
    filter: (filename, data) => {
      return data.request.method === 'GET' && 
             data.request.url.includes('/api/posts/');
    },
    transform: (data) => {
      // Extract post ID from URL
      const urlParts = data.request.url.split('/');
      const postId = urlParts[urlParts.length - 1];
      return { id: postId };
    }
  });

  return mockData.data;
}

export async function generateStaticProps({ params }: { params: { id: string } }) {
  const mockDataPath = path.join(process.cwd(), 'mock-data');
  
  const mockData = loadMockDataForBuild({
    mockDataPath,
    filter: (filename, data) => {
      return data.request.method === 'GET' && 
             data.request.url.includes(`/api/posts/${params.id}`);
    },
    transform: (data) => data.response.data
  });

  if (mockData.data.length === 0) {
    return { notFound: true };
  }

  return {
    props: {
      post: mockData.data[0]
    },
    revalidate: 3600
  };
}

