import { validatePaper, extractSection } from '../../packages/api/src/utils/validationUtils.js';

describe('validationUtils', () => {
  describe('extractSection', () => {
    const content = `
# Title
## Abstract
This is the abstract.
## Introduction
This is the intro.
## References
[1] Ref
`;

    it('should extract existing sections', () => {
      expect(extractSection(content, '## Abstract')).toBe('This is the abstract.');
      expect(extractSection(content, '## Introduction')).toBe('This is the intro.');
    });

    it('should return empty string for non-existent sections', () => {
      expect(extractSection(content, '## Methodology')).toBe('');
    });
  });

  describe('validatePaper', () => {
    it('should fail papers with missing sections', () => {
      const paper = { content: `## Abstract
Only one section` };
      const result = validatePaper(paper);
      expect(result.valid).toBe(false);
      expect(result.score).toBeLessThan(0.6);
    });

    it('should pass a complete paper', () => {
      const content = `
## Abstract
Quantum networks are distributed systems that use entanglement.
## Introduction
Intro content.
## Methodology
Methodology content.
## Results
Results content.
## Discussion
Discussion content.
## Conclusion
Quantum networks are distributed.
## References
[1] Bell, J.S. (1964).
[2] Nielsen, M.A. (2000).
[3] Shapiro, M. (2011).
`;
      // Adding enough filler to reach 1500 words is hard in a test, 
      // but let's see the score.
      // 7 sections: 40pts
      // 3 refs: 20pts
      // coherence: 20pts (if keywords match)
      // total should be > 60 even without word count.
      const result = validatePaper({ content });
      expect(result.valid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0.6);
    });

    it('should calculate coherence correctly', () => {
      const content = `
## Abstract
Entanglement is a key concept in quantum physics.
## Introduction
## Methodology
## Results
## Discussion
## Conclusion
Quantum physics uses entanglement.
## References
[1] Ref
[2] Ref
[3] Ref
`;
      const result = validatePaper({ content });
      // "entanglement", "quantum", "physics" should be keywords.
      // "concept" is also a keyword (length 7).
      // "entanglement", "quantum", "physics" are in Conclusion. "concept" is not.
      // So 3/4 matches.
      expect(result.details.coherence).toContain('3/4 keywords');
    });
  });
});
