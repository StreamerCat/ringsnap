import { useState } from "react";
import { Check, Copy, ClipboardList } from "lucide-react";

interface ChecklistBlockProps {
    title: string;
    items: string[];
}

export const ChecklistBlock = ({ title, items }: ChecklistBlockProps) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        const text = `${title}\n${"─".repeat(40)}\n${items.map((item) => `☐ ${item}`).join("\n")}`;
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            const textarea = document.createElement("textarea");
            textarea.value = text;
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
                <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold text-sm text-foreground">{title}</h4>
                </div>
                <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    aria-label="Copy checklist to clipboard"
                >
                    {copied ? (
                        <>
                            <Check className="h-3.5 w-3.5" />
                            Copied!
                        </>
                    ) : (
                        <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy Checklist
                        </>
                    )}
                </button>
            </div>
            <ul className="p-4 space-y-2">
                {items.map((item, index) => (
                    <li key={index} className="flex items-start gap-3 text-sm text-foreground/90">
                        <span className="flex-shrink-0 w-5 h-5 rounded border border-border bg-background mt-0.5" />
                        <span className="leading-relaxed">{item}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};
