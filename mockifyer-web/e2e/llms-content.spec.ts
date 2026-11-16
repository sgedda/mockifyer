import { test, expect } from '@playwright/test';

test.describe('LLMs Content Files', () => {
  test('llms-full.txt should contain /packages', async ({ request }) => {
    const response = await request.get('/llms-full.txt');
    expect(response.status()).toBe(200);
    
    const content = await response.text();
    
    // Should mention packages
    expect(content).toContain('/packages');
    expect(content).toContain('https://mockifyer.dev/packages');
    
    // Should list package names
    expect(content).toContain('@sgedda/mockifyer-core');
    expect(content).toContain('@sgedda/mockifyer-axios');
    expect(content).toContain('@sgedda/mockifyer-fetch');
    expect(content).toContain('@sgedda/mockifyer-dashboard');
  });
  
  test('llms-full.txt should contain guide pages', async ({ request }) => {
    const response = await request.get('/llms-full.txt');
    const content = await response.text();
    
    // Should list guides
    expect(content).toContain('/guides');
    expect(content).toContain('/guides/mock-at-the-network-edge');
    expect(content).toContain('/guides/reproduce-tester-bugs');
    expect(content).toContain('/guides/stable-react-native-e2e');
    expect(content).toContain('/guides/mock-drift');
    expect(content).toContain('/guides/react-native-without-msw');
  });
  
  test('llms-full.txt should have structured sections', async ({ request }) => {
    const response = await request.get('/llms-full.txt');
    const content = await response.text();
    
    // Should have key sections
    expect(content).toContain('## Packages');
    expect(content).toContain('## Setup');
    expect(content).toContain('## Activation modes');
    expect(content).toContain('## GraphQL');
    expect(content).toContain('## Dashboard & MCP');
    expect(content).toContain('## Content Pages');
    expect(content).toContain('## Links');
  });
  
  test('llms.txt should exist and contain key info', async ({ request }) => {
    const response = await request.get('/llms.txt');
    expect(response.status()).toBe(200);
    
    const content = await response.text();
    
    // Should have core content
    expect(content).toContain('Mockifyer');
    expect(content).toContain('## npm packages');
    expect(content).toContain('## Quick start');
    expect(content).toContain('https://mockifyer.dev');
  });
  
  test('llms.txt should reference llms-full.txt', async ({ request }) => {
    const response = await request.get('/llms.txt');
    const content = await response.text();
    
    // Should link to full version
    expect(content).toContain('llms-full.txt');
    expect(content).toContain('Full AI context');
  });
  
  test('llms-full.txt should contain MCP tool information', async ({ request }) => {
    const response = await request.get('/llms-full.txt');
    const content = await response.text();
    
    // Should mention MCP tools
    expect(content).toContain('MCP server');
    expect(content).toContain('42 tools');
    expect(content).toContain('mockifyer_get_mock_ai_context');
    expect(content).toContain('mockifyer_search_mocks');
  });
});
