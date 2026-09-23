export type SkillTrack = "teaching" | "project-management" | "admin-crm" | "finance-compliance";

type UserProfileInput = {
  name?: string;
  email?: string;
  skill: SkillTrack;
  primary_career?: string;
  secondary_careers?: string[];
};

type ProfileDescriptionInput = {
  skills: string[];
  ai_capabilities?: string[];
  primary_career?: string;
  secondary_careers?: string[];
};

const skillNames: Record<SkillTrack, string> = {
  teaching: "teaching and coaching",
  "project-management": "project management",
  "admin-crm": "administration and CRM",
  "finance-compliance": "finance and compliance",
};

const defaultAICapabilities = [
  "AI workflow execution",
  "Automated task delivery",
  "Client communication automation",
  "High-speed project turnaround",
];

export function enhanceWithAICapabilities<T extends { ai_capabilities?: string[]; skills?: string[] }>(profile: T) {
  const existingCapabilities = Array.isArray(profile.ai_capabilities) ? profile.ai_capabilities : [];

  return {
    ...profile,
    ai_capabilities: Array.from(new Set([...existingCapabilities, ...defaultAICapabilities])),
  };
}

export function generateSafeProfile<T extends {
  description?: string;
  profileDescription?: string;
  bio?: string;
}>(profile: T) {
  const sanitize = (text: string | undefined) => String(text || "")
    .replace(/AI does everything/gi, "AI-assisted workflows")
    .replace(/fully automated/gi, "efficient and scalable");

  return {
    ...profile,
    description: sanitize(profile.description),
    profileDescription: sanitize(profile.profileDescription),
    bio: sanitize(profile.bio),
  };
}

export function generateProfileDescription(user: ProfileDescriptionInput) {
  const primaryCareer = String(user.primary_career || "").trim();
  const secondaryCareers = Array.isArray(user.secondary_careers)
    ? user.secondary_careers.filter(Boolean)
    : [];
  const listedSkills = user.skills.length > 0 ? user.skills.join(", ") : "remote support and digital execution";
  const aiCapabilities = (user.ai_capabilities || defaultAICapabilities).join(", ");

  if (primaryCareer) {
    return `I specialize in ${primaryCareer}, delivering reliable and high-quality results.

Additionally, I support work in:
${secondaryCareers.join(", ") || "related tasks"}.

I use efficient workflows to:
✔ Deliver fast turnaround
✔ Handle multiple tasks efficiently
✔ Maintain consistent quality

Available to start immediately.`;
  }

  return `I am a results-driven professional skilled in ${listedSkills}.

I use efficient workflows and modern tools to deliver work faster, more accurately, and consistently.

I can assist with:
✔ Task execution
✔ Automation
✔ Client communication
✔ Fast turnaround projects

Capabilities included in my workflow: ${aiCapabilities}.

I am committed to delivering high-quality results consistently.`;
}

export function generateProfile(user: UserProfileInput) {
  const name = user.name?.trim() || "Professional";
  const skill = skillNames[user.skill] || user.skill;

  const enhancedProfile = enhanceWithAICapabilities({
    title: "AI-Enhanced Virtual Assistant",
    ai_experience: true,
    capabilities: defaultAICapabilities,
    description: `${name} delivers ${skill} support through AI-assisted workflows, reliable communication, and fast project turnaround.`,
    bio: `${name} specializes in ${skill}, helping clients achieve reliable outcomes with clear communication and measurable execution.`,
    skills: [skill, "Admin Support", "Data Entry", "communication", "problem-solving"],
    linkedinBio: `${name} is a results-focused specialist in ${skill}. I help teams improve speed, structure, and delivery quality across remote projects.`,
    upworkProfile: `I help clients solve complex work through ${skill}. Expect proactive updates, strong organization, and dependable execution from kickoff to handover.`,
    fiverrGig: `I will deliver high-quality support in ${skill}, with clear milestones, fast communication, and practical solutions that fit your business goals.`,
    cvSummary: `${name} has practical experience in ${skill}, workflow optimization, and client delivery. Trusted for accuracy, consistency, and results.`,
  });

  return generateSafeProfile({
    ...enhancedProfile,
    capabilities: defaultAICapabilities,
    profileDescription: generateProfileDescription({
      skills: enhancedProfile.skills,
      ai_capabilities: enhancedProfile.ai_capabilities,
      primary_career: user.primary_career,
      secondary_careers: user.secondary_careers,
    }),
  });
}
