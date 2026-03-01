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

const RESOURCE_CONTENT: Record<string, any> = {
    hvac: {
        title: "HVAC Dispatcher Script Pack",
        subtitle: "RingSnap Field Guide: High-Performance HVAC Call Handling",
        sections: [
            {
                heading: "The 4-Step Call Flow",
                content: [
                    "1. Greet & Identify: Answer within 3 rings. 'Thanks for calling [Company], this is [Name].'",
                    "2. Qualify the Call: Emergency, Maintenance, or New Install?",
                    "3. Capture Information: Name, Address, Phone, System Type, Symptoms.",
                    "4. Confirm & Set Expectations: Repeat appointment time and technician ETA."
                ]
            },
            {
                heading: "Standard Inbound Script",
                content: [
                    "Dispatcher: 'I can definitely help you with that. Let me grab a few quick details.'",
                    "- Can I get your name and service address?",
                    "- What kind of system do you have (AC, Heat Pump, Furnace)?",
                    "- Perfect. We have availability [time]. Which works best?",
                    "Diagnostic fee: $XX (Applied toward repair)."
                ]
            }
        ]
    },
    plumbing: {
        title: "Plumbing Dispatcher Script Pack",
        subtitle: "RingSnap Field Guide: Emergency Plumbing & Drain Cleaning",
        sections: [
            {
                heading: "Burst Pipe Protocol",
                content: [
                    "1. Is water actively flowing? GUIDE TO SHUTOFF VALVE IMMEDIATELY.",
                    "2. 'Find your main water shutoff — turn it clockwise until it stops.'",
                    "3. Reassure: 'You did the right thing calling. We're getting a plumber to you now.'"
                ]
            },
            {
                heading: "Sewer Backup Triage",
                content: [
                    "- Is sewage actively coming up? Which drains?",
                    "- SAFETY: Keep children and pets away. Do not use any drains/toilets.",
                    "- Priority dispatch within [X] hours."
                ]
            }
        ]
    },
    electrical: {
        title: "Electrician Call Answering Pack",
        subtitle: "RingSnap Field Guide: Electrical Safety Triage & Panel Upgrades",
        sections: [
            {
                heading: "Safety Screening (First 30 Seconds)",
                content: [
                    "- Do you see sparks, smoke, or flames? (If yes -> 911)",
                    "- Is anyone in contact with a live wire? (If yes -> 911)",
                    "- Smell burning? (Turn off main breaker if safe)."
                ]
            }
            // More sections can be added here
        ]
    }
};

export const ResourceDownloadModal = ({
    isOpen,
    onClose,
    resourceName,
    trade = "General",
}: ResourceDownloadModalProps) => {
    const [email, setEmail] = useState("");
    const [fullName, setFullName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const generateAndDownloadPDF = async (name: string) => {
        const { jsPDF } = await import("jspdf");
        const normalized = name.toLowerCase();
        let resource = RESOURCE_CONTENT.general;

        if (normalized.includes("hvac")) resource = RESOURCE_CONTENT.hvac;
        else if (normalized.includes("plumb")) resource = RESOURCE_CONTENT.plumbing;
        else if (normalized.includes("electric")) resource = RESOURCE_CONTENT.electrical;

        if (!resource) {
            // Fallback for general case
            resource = {
                title: "Contractor Service Script Pack",
                subtitle: "RingSnap Field Guide: Professional Service Call Intake",
                sections: [
                    {
                        heading: "Professional Greeting",
                        content: [
                            "Warm, professional, fast (under 3 rings).",
                            "'Thanks for calling [Company], this is [Name], how can I help you today?'",
                            "Use a consistent script to ensure professional branding."
                        ]
                    },
                    {
                        heading: "Lead Capture Essentials",
                        content: [
                            "Full Name & Phone Number",
                            "Service Address (confirm City/Zip)",
                            "Problem Description & Urgency"
                        ]
                    }
                ]
            };
        }

        const doc = new jsPDF();
        const margin = 20;
        let y = 20;

        // Header
        doc.setFontSize(22);
        doc.setTextColor(33, 33, 33);
        doc.text(resource.title, margin, y);
        y += 10;

        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        doc.text(resource.subtitle, margin, y);
        y += 15;

        // Horizontal Line
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, y, 190, y);
        y += 15;

        // Sections
        resource.sections.forEach((section: any) => {
            if (y > 250) {
                doc.addPage();
                y = 20;
            }

            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.setFont("helvetica", "bold");
            doc.text(section.heading, margin, y);
            y += 8;

            doc.setFontSize(11);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(60, 60, 60);
            section.content.forEach((line: string) => {
                const splitText = doc.splitTextToSize(line, 170);
                doc.text(splitText, margin, y);
                y += (splitText.length * 6);
            });
            y += 5;
        });

        // Footer
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text("Generated by RingSnap - Built for Trades", margin, 285);
        doc.text("www.ringsnap.com", 160, 285);

        doc.save(`${name.toLowerCase().replace(/\s+/g, "-")}-pack.pdf`);
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
                description: `A copy of the ${resourceName} has been generated for you.`,
            });

            // 3. Trigger the PDF generation
            await generateAndDownloadPDF(resourceName);

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
                        {isSubmitting ? "Generating PDF..." : "Get Script Pack Now"}
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground uppercase tracking-widest font-semibold pt-2">
                        Verified Secure Download
                    </p>
                </form>
            </DialogContent>
        </Dialog>
    );
};
