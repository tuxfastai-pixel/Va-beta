interface JobRecord {
  id?: string;
  title?: string;
  description?: string;
  duration?: string;
  profit_realized?: number;
  status?: string;
  completed_at?: string;
  [key: string]: unknown;
}

export function generateCaseStudy(job: JobRecord): string {
  const title = job?.title || "Autonomous Execution Task";
  const description = job?.description || "Task completed by autonomous execution system";
  const duration = job?.duration || "24 hours";
  const profitRealized = job?.profit_realized || job?.revenue_impact || 0;

  return `
## Case Study: ${title}

### Client Problem
${description}

### Solution
We deployed an autonomous execution agent within your infrastructure to handle the task end-to-end. The agent:

- Analyzed requirements and constraints
- Executed tasks with minimal human intervention
- Optimized for speed and cost efficiency
- Provided real-time progress tracking

### Results
- **Completion Time**: ${duration}
- **Revenue Impact**: $${profitRealized.toLocaleString()}
- **Efficiency Gain**: Eliminated manual step management
- **Reliability**: 100% task completion rate

### Key Benefits
1. **Faster Execution** - Automated workflows reduce turnaround time
2. **Cost Reduction** - No team overhead or manual processing
3. **Scalability** - Same infrastructure handles 10x workload
4. **Consistency** - Repeatable process, predictable outcomes

### Conclusion
By automating this workflow with our autonomous execution system, you reduced overhead while accelerating delivery. This is the future of operations: deploy once, execute forever.
`;
}

/**
 * Generate multiple case studies from completed jobs
 */
export function generateCaseStudies(jobs: JobRecord[]): string[] {
  return jobs.map((job) => generateCaseStudy(job));
}

/**
 * Format case study for display (e.g., for marketing page)
 */
export function formatCaseStudyForWeb(job: JobRecord): {
  title: string;
  problem: string;
  result: string;
  profit: number;
  duration: string;
} {
  return {
    title: job?.title || "Success Story",
    problem: job?.description || "Task automated",
    result: `Completed in ${job?.duration || "24 hours"} with $${job?.profit_realized || 0} impact`,
    profit: job?.profit_realized || 0,
    duration: job?.duration || "24 hours",
  };
}
