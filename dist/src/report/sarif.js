/**
 * Format a CyberPulse report as SARIF 2.1.0 JSON.
 * SARIF is the standard format for static analysis tools (used by GitHub, GitLab, etc.)
 */
export function formatSarif(report) {
    const rules = report.findings.map((f) => ({
        id: f.owaspId,
        name: f.title,
        shortDescription: { text: `${f.owaspId}: ${f.title}` },
        fullDescription: { text: f.evidence },
        help: { text: `Severity: ${f.severity}\nRepro: ${f.repro.payload}` },
        properties: {
            severity: f.severity,
            tags: [f.owaspId, f.severity, f.closed ? 'closed' : 'open'],
        },
    }));
    const results = report.findings.map((f) => ({
        ruleId: f.owaspId,
        level: f.severity === 'critical' || f.severity === 'high' ? 'error' : 'warning',
        message: { text: `${f.title}: ${f.evidence}` },
        locations: [
            {
                physicalLocation: {
                    artifactLocation: { uri: f.repro.target },
                    region: { startLine: 1, startColumn: 1 },
                },
            },
        ],
        properties: {
            findingId: f.id,
            closed: f.closed,
            repro: f.repro,
        },
    }));
    return {
        version: '2.1.0',
        $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
        runs: [
            {
                tool: {
                    driver: {
                        name: 'CyberPulse Auditor',
                        version: '0.1.0',
                        informationUri: 'https://github.com/example/cyberpulse',
                        rules,
                    },
                },
                results,
                properties: {
                    runId: report.runId,
                    status: report.status,
                    goal: report.goal,
                    iterations: report.iterations,
                },
            },
        ],
    };
}
//# sourceMappingURL=sarif.js.map