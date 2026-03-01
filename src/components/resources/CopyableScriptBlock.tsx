import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CopyableScriptBlockProps {
    title: string;
    script: string;
    scenario?: string;
}

export const CopyableScriptBlock = ({ title, script, scenario }: CopyableScriptBlockProps) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(script);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for older browsers
            const textarea = document.createElement("textarea");
            textarea.value = script;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="my-6 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
                <div>
                    <h4 className="font-semibold text-sm text-foreground">{title}</h4>
                    {scenario && (
                        <span className="text-xs text-muted-foreground">{scenario}</span>
                    )}
                </div>
                <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    aria-label="Copy script to clipboard"
                >
                    {copied ? (
                        <>
                            <Check className="h-3.5 w-3.5" />
                            Copied!
                        </>
                    ) : (
                        <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy
                        </>
                    )}
                </button>
            </div>
            <pre className="p-4 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap font-secondary overflow-x-auto">
                {script}
            </pre>
        </div>
    );
};
