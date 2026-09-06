import type { OwaspId, Severity } from './types.js';
export interface AttackTranscript {
    owaspId: OwaspId;
    targetId: string;
    turns: Array<{
        role: 'user' | 'assistant' | 'system';
        content: string;
    }>;
    rawResponse: string;
    /** Whether the attack achieved its intended effect */
    success: boolean;
    error?: string;
}
export interface Finding {
    id: string;
    owaspId: OwaspId;
    severity: Severity;
    title: string;
    evidence: string;
    repro: {
        payload: string;
        target: string;
        expected: string;
    };
}
export interface EvaluationResult {
    findings: Finding[];
    transcript: AttackTranscript;
}
/**
 * OWASP Evaluator — maps an attack transcript to one or more Findings.
 * Uses pattern matching against the OWASP catalog's common_patterns.
 */
export declare class OwaspEvaluator {
    private readonly catalog;
    /**
     * Evaluate a single attack transcript and return findings.
     * Returns an empty array if no vulnerability was detected.
     */
    evaluate(transcript: AttackTranscript): Finding[];
    /**
     * Evaluate multiple transcripts and deduplicate findings by OWASP id.
     * If the same OWASP id appears in multiple transcripts, keeps the most severe.
     */
    evaluateBatch(transcripts: AttackTranscript[]): Finding[];
    private extractEvidence;
    private buildRepro;
}
