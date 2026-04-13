import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ResourceDownloadModalProps {
    isOpen: boolean;
    onClose: () => void;
    resourceName: string;
    trade?: string;
}

export const ResourceDownloadModal = ({
    isOpen,
    onClose,
    resourceName,
    trade = "General",
}: ResourceDownloadModalProps) => {
    const [email, setEmail] = useState("");
    const [fullName, setFullName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const downloadStaticScriptPack = () => {
        const staticPdfPath = "/resources/ringsnap-contractor-call-conversion-pack.pdf";
        const link = document.createElement("a");
        link.href = staticPdfPath;
        link.download = "ringsnap-contractor-call-conversion-pack.pdf";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // 1. Store lead in Supabase
            const { error: dbError } = await (supabase as any)
                .from("resource_subscriber_leads")
                .insert([
                    {
                        email,
                        full_name: fullName,
                        resource_name: resourceName,
                        trade: trade,
                        metadata: {
                            source: window.location.pathname,
                        },
                    },
                ]);

            if (dbError) {
                console.error("Error storing lead:", dbError);
            }

            // 2. Success message
            toast.success("Download started!", {
                description: `Your ${resourceName} is ready to download.`,
            });

            // 3. Trigger static PDF download
            downloadStaticScriptPack();

            onClose();
            setEmail("");
            setFullName("");
        } catch (err) {
            console.error("Submit error:", err);
            toast.error("Something went wrong. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Download className="h-5 w-5 text-primary" />
                        Download {resourceName}
                    </DialogTitle>
                    <DialogDescription>
                        Enter your details below to get the full script pack and checklists instantly.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input
                            id="fullName"
                            placeholder="John Doe"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="bg-background"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Work Email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="you@yourshop.com"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="bg-background"
                        />
                    </div>
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? "Preparing Download..." : "Get Script Pack Now"}
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground uppercase tracking-widest font-semibold pt-2">
                        Verified Secure Download
                    </p>
                </form>
            </DialogContent>
        </Dialog>
    );
};
