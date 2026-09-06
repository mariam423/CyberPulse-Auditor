import { logger } from '../util/logger.js';
import { loadCatalog } from './catalog.js';
/**
 * OWASP Evaluator — maps an attack transcript to one or more Findings.
 * Uses pattern matching against the OWASP catalog's common_patterns.
 */
export class OwaspEvaluator {
    catalog = loadCatalog();
    /**
     * Evaluate a single attack transcript and return findings.
     * Returns an empty array if no vulnerability was detected.
     */
    evaluate(transcript) {
        const entry = this.catalog.get(transcript.owaspId);
        if (!entry) {
            logger.warn('owasp:evaluator', `Unknown OWASP id: ${transcript.owaspId}`);
            return [];
        }
        logger.debug('owasp:evaluator', `Evaluating ${transcript.owaspId} — success=${transcript.success}`);
        if (!transcript.success) {
            // Attack did not succeed — no finding
            return [];
        }
        // Build evidence from the transcript
        const evidence = this.extractEvidence(transcript);
        const repro = this.buildRepro(transcript);
        const finding = {
            id: `fnd_${Math.random().toString(36).slice(2, 10)}`,
            owaspId: transcript.owaspId,
            severity: entry.severity,
            title: entry.title,
            evidence,
            repro,
        };
        logger.info('owasp:evaluator', `Found: ${entry.id} (${entry.severity}) — ${entry.title}`);
        return [finding];
    }
    /**
     * Evaluate multiple transcripts and deduplicate findings by OWASP id.
     * If the same OWASP id appears in multiple transcripts, keeps the most severe.
     */
    evaluateBatch(transcripts) {
        const allFindings = transcripts.flatMap((t) => this.evaluate(t));
        const byId = new Map();
        const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
        for (const f of allFindings) {
            const existing = byId.get(f.owaspId);
            if (!existing || severityOrder.indexOf(f.severity) < severityOrder.indexOf(existing.severity)) {
                byId.set(f.owaspId, f);
            }
        }
        return Array.from(byId.values());
    }
    extractEvidence(t) {
        // Grab the last few user turns and the assistant response
        const userTurns = t.turns.filter((tr) => tr.role === 'user').slice(-2);
        const assistantTurns = t.turns.filter((tr) => tr.role === 'assistant').slice(-1);
        const lines = [];
        for (const ut of userTurns) {
            lines.push(`[user] ${ut.content.slice(0, 200)}`);
        }
        if (assistantTurns[0]) {
            lines.push(`[assistant] ${assistantTurns[0].content.slice(0, 200)}`);
        }
        return lines.join('\n');
    }
    buildRepro(t) {
        const firstUserTurn = t.turns.find((tr) => tr.role === 'user');
        return {
            payload: firstUserTurn?.content ?? t.turns[0]?.content ?? '',
            target: t.targetId,
            expected: `Attack should be blocked or neutralized`,
        };
    }
}
//# sourceMappingURL=evaluator.js.map