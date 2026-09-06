import { z } from 'zod';
export declare const OwaspIdSchema: z.ZodEnum<["LLM01", "LLM02", "LLM03", "LLM04", "LLM05", "LLM06", "LLM07", "LLM08", "LLM09", "LLM10"]>;
export type OwaspId = z.infer<typeof OwaspIdSchema>;
export declare const SeveritySchema: z.ZodEnum<["critical", "high", "medium", "low", "info"]>;
export type Severity = z.infer<typeof SeveritySchema>;
export declare const OwaspEntrySchema: z.ZodObject<{
    id: z.ZodEnum<["LLM01", "LLM02", "LLM03", "LLM04", "LLM05", "LLM06", "LLM07", "LLM08", "LLM09", "LLM10"]>;
    title: z.ZodString;
    description: z.ZodString;
    severity: z.ZodEnum<["critical", "high", "medium", "low", "info"]>;
    common_patterns: z.ZodArray<z.ZodString, "many">;
    mitigation: z.ZodString;
}, "strip", z.ZodTypeAny, {
    description: string;
    id: "LLM01" | "LLM02" | "LLM03" | "LLM04" | "LLM05" | "LLM06" | "LLM07" | "LLM08" | "LLM09" | "LLM10";
    title: string;
    severity: "medium" | "info" | "critical" | "high" | "low";
    common_patterns: string[];
    mitigation: string;
}, {
    description: string;
    id: "LLM01" | "LLM02" | "LLM03" | "LLM04" | "LLM05" | "LLM06" | "LLM07" | "LLM08" | "LLM09" | "LLM10";
    title: string;
    severity: "medium" | "info" | "critical" | "high" | "low";
    common_patterns: string[];
    mitigation: string;
}>;
export type OwaspEntry = z.infer<typeof OwaspEntrySchema>;
export declare const SEVERITY_ORDER: Record<Severity, number>;
export declare function severityGt(a: Severity, b: Severity): boolean;
