/**
 * Test: Path decode can split encoded segments
 * Bug ID: 4577962026
 * 
 * decodeURIComponent on pathname turns %2F into /, so a single encoded segment
 * like /files/some%2Fname becomes /files/some/name and gets treated as two segments.
 */

import { normalizeUrlToTemplate } from '../packages/mockifyer-core/src/utils/atlas-url-normalizer';

describe('Path decoding should not split encoded segments', () => {
  it('should preserve encoded slashes within a segment', () => {
    const url = 'https://api.example.com/files/document%2Fname.pdf';
    const result = normalizeUrlToTemplate(url);
    
    // FIXED: %2F is NOT decoded, stays as %2F to prevent segment splitting
    // The path has 2 segments: /files and /document%2Fname.pdf
    // Since the segment contains %2F, it stays literal (no pattern matches)
    // Result: /files/document%2Fname.pdf (NOT parameterized, which is correct)
    expect(result.template).toBe('/files/document%2Fname.pdf');
    
    // Should NOT become 3 segments /files/document/{slug} (this would be the bug)
    expect(result.template).not.toBe('/files/document/{slug}');
  });

  it('should handle other encoded characters without splitting', () => {
    const url = 'https://api.example.com/files/name%20with%20spaces.txt';
    const result = normalizeUrlToTemplate(url);
    
    // %20 is decoded to space - the segment becomes "name with spaces.txt"
    // Still 2 segments: /files and /name with spaces.txt
    // This could parameterize to /files/{slug} if patterns match decoded spaces
    // But likely stays literal: /files/name with spaces.txt
    expect(result.template).toBe('/files/name with spaces.txt');
  });

  it('should handle multiple encoded slashes', () => {
    const url = 'https://api.example.com/paths/a%2Fb%2Fc';
    const result = normalizeUrlToTemplate(url);
    
    // FIXED: %2F stays encoded, so a%2Fb%2Fc is one segment
    // 2 segments total: /paths and /a%2Fb%2Fc
    // Result: /paths/a%2Fb%2Fc (literal, not parameterized)
    expect(result.template).toBe('/paths/a%2Fb%2Fc');
    
    // Should NOT become /paths/a/b/{id} (4 segments) - this would be the bug
    expect(result.template).not.toBe('/paths/a/b/{id}');
    expect(result.template).not.toBe('/paths/a/b/c');
  });

  it('should handle URLs with both real and encoded slashes', () => {
    const url = 'https://api.example.com/files/dir/sub%2Ffile.txt';
    const result = normalizeUrlToTemplate(url);
    
    // 3 real segments: /files, /dir, /sub%2Ffile.txt (last has encoded slash preserved)
    // Result: /files/dir/sub%2Ffile.txt (literal)
    expect(result.template).toBe('/files/dir/sub%2Ffile.txt');
    
    // Should NOT become /files/dir/sub/file.txt (4 segments) - that would be the bug
    expect(result.template).not.toBe('/files/dir/sub/file.txt');
  });
});
