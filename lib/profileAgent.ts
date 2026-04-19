type LinkedInProfileInput = {
  career_goal?: string | null;
};

type LinkedInSkill = {
  skill?: string | null;
};

export function buildLinkedInProfile(profile: LinkedInProfileInput, skills: LinkedInSkill[]) {
  return {
    headline:
      `${profile.career_goal} | Remote Support Specialist`,

    about:
      `
Detail-oriented professional skilled in
CRM tools, communication, and remote operations.
      `,

    skills: skills.map((skill) => skill.skill).filter((skill): skill is string => Boolean(skill))
  }
}
