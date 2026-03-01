import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

interface ResourceLink {
    title: string;
    description: string;
    href: string;
    tag?: string;
}

interface RelatedResourcesProps {
    resources: ResourceLink[];
}

export const RelatedResources = ({ resources }: RelatedResourcesProps) => {
    return (
        <section className="my-12">
            <h2 className="text-2xl font-bold text-foreground mb-6">Related Resources</h2>
            <div className="grid md:grid-cols-3 gap-4">
                {resources.map((resource, index) => (
                    <Link
                        key={index}
                        to={resource.href}
                        className="group rounded-xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-md transition-all"
                    >
                        {resource.tag && (
                            <span className="inline-block text-xs font-medium text-primary bg-primary/10 rounded-full px-2.5 py-0.5 mb-3">
                                {resource.tag}
                            </span>
                        )}
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-2 text-sm">
                            {resource.title}
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                            {resource.description}
                        </p>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                            Read more
                            <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                    </Link>
                ))}
            </div>
        </section>
    );
};
