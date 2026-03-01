interface BenchmarkRow {
    metric: string;
    industryAvg: string;
    topPerformer: string;
}

interface BenchmarkTableProps {
    title?: string;
    rows: BenchmarkRow[];
    source?: string;
}

export const BenchmarkTable = ({ title, rows, source }: BenchmarkTableProps) => {
    return (
        <div className="my-8">
            {title && <h3 className="text-lg font-bold text-foreground mb-4">{title}</h3>}
            <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-muted/50 border-b border-border">
                            <th className="text-left px-4 py-3 font-semibold text-foreground">Metric</th>
                            <th className="text-left px-4 py-3 font-semibold text-foreground">Industry Average</th>
                            <th className="text-left px-4 py-3 font-semibold text-primary">Top Performers</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, index) => (
                            <tr key={index} className={index % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                                <td className="px-4 py-3 font-medium text-foreground">{row.metric}</td>
                                <td className="px-4 py-3 text-muted-foreground">{row.industryAvg}</td>
                                <td className="px-4 py-3 text-primary font-medium">{row.topPerformer}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {source && (
                <p className="text-xs text-muted-foreground mt-2 italic">{source}</p>
            )}
        </div>
    );
};
