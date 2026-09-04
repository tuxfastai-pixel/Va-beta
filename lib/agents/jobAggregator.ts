import { jobHunterAgent } from "@/lib/agents/jobHunterAgent";
import { fetchFlexJobs } from "@/lib/agents/flexjobsAgent";
import { normalizeJob } from "@/lib/platforms/normalizeJob";
import { getPlatformWeight } from "@/lib/platforms/platformRegistry";

export async function fetchAllJobs(user: {
  id: string;
  resume?: string | null;
  profile?: string | null;
  careers: string[];
}) {
  const jobs = [] as Array<Record<string, unknown>>;

  for (const career of user.careers) {
    const [remotive, flex] = await Promise.all([
      jobHunterAgent({
        user_id: user.id,
        resume: user.resume,
        profile: user.profile,
        careerFocus: career,
        jobLimit: 10,
      }),
      fetchFlexJobs(career),
    ]);

    const remotiveJobs = Array.isArray(remotive.data) ? remotive.data : [];
    jobs.push(
      ...remotiveJobs.map((job) =>
        normalizeJob({
          ...job,
          platform: "indeed",
          platformWeight: getPlatformWeight("indeed"),
        })
      )
    );
    jobs.push(
      ...flex.map((job) =>
        normalizeJob({
          ...job,
          platform: "flexjobs",
          platformWeight: getPlatformWeight("flexjobs"),
        })
      )
    );
  }

  return jobs;
}
