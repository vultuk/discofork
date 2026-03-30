export type CommandSpec = {
  command: string
  args: string[]
  cwd?: string
  input?: string
  env?: Record<string, string>
}

export type CommandResult = {
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
}

export type GitHubRepoRef = {
  owner: string
  name: string
  fullName: string
  url: string
  cloneUrl: string
}

export type RepoMetadata = {
  fullName: string
  description: string | null
  homepageUrl: string | null
  defaultBranch: string
  isArchived: boolean
  forkCount: number
  stargazerCount: number
  pushedAt: string | null
  updatedAt: string | null
}

export type ForkMetadata = RepoMetadata & {
  sourceFullName: string
  parentFullName: string | null
  createdAt: string | null
  archivedAt: string | null
  comparisonStatus: string | null
  aheadBy: number | null
  behindBy: number | null
  hasChanges: boolean | null
  pushedDaysAgo: number | null
  score: number
  scoreReasons: string[]
  defaultSelected: boolean
}

export type ForkSelectionStrategy = "stars" | "recent"

export type DiscoveryResult = {
  upstream: RepoMetadata
  scannedForkCount: number
  totalForkCount: number
  archivedExcluded: number
  unchangedExcluded: number
  selectionWarning: string | null
  forks: ForkMetadata[]
}

export type RepoFacts = {
  metadata: RepoMetadata
  topLevelEntries: string[]
  topDirectories: string[]
  topFiles: string[]
  readmeExcerpt: string | null
  manifestFiles: Array<{
    path: string
    excerpt: string
  }>
  recentCommits: Array<{
    sha: string
    subject: string
    authoredAt: string
  }>
  detectedTech: string[]
}

export type DiffFacts = {
  mergeBase: string | null
  aheadCount: number
  behindCount: number
  changedFiles: number
  insertions: number
  deletions: number
  renamedFiles: number
  topChangedPaths: Array<{
    path: string
    changes: number
  }>
  topChangedDirectories: Array<{
    path: string
    percent: number
  }>
  uniqueCommits: Array<{
    sha: string
    subject: string
    authoredAt: string
  }>
  fileKinds: Array<{
    label: string
    count: number
  }>
  sampleFileSummaries: Array<{
    path: string
    additions: number
    deletions: number
  }>
}

export type UpstreamAnalysis = {
  summary: string
  capabilities: string[]
  targetUsers: string[]
  architectureNotes: string[]
  evidence: string[]
}

export type ForkAnalysis = {
  fork: string
  maintenance: "active" | "slowing" | "stale" | "unknown"
  changeMagnitude: "minor" | "moderate" | "substantial" | "significant_divergence"
  likelyPurpose: string
  changeCategories: string[]
  additionalFeatures: string[]
  missingFeatures: string[]
  strengths: string[]
  risks: string[]
  idealUsers: string[]
  decisionSummary: string
  confidence: "low" | "medium" | "high"
  evidence: string[]
}

export type RecommendationSummary = {
  bestMaintained: string | null
  closestToUpstream: string | null
  mostFeatureRich: string | null
  mostOpinionated: string | null
}

export type FinalReport = {
  generatedAt: string
  repository: GitHubRepoRef
  upstream: RepoFacts & {
    analysis: UpstreamAnalysis
  }
  discovery: {
    totalForkCount: number
    scannedForkCount: number
    archivedExcluded: number
    unchangedExcluded: number
    selectionWarning: string | null
  }
  forks: Array<{
    metadata: ForkMetadata
    diffFacts: DiffFacts
    analysis: ForkAnalysis
  }>
  recommendations: RecommendationSummary
}

export type ProgressEvent =
  | { type: "status"; message: string }
  | { type: "warning"; message: string }
  | { type: "error"; message: string }
  | { type: "progress"; phase: string; detail: string; current: number; total: number }
  | { type: "phase"; phase: string; detail: string }
  | { type: "fork"; fork: string; detail: string }

export type AnalysisOptions = {
  includeArchived: boolean
  forkScanLimit: number
  recommendedForkLimit: number
  compareConcurrency: number
  selectedForks?: string[]
  maxCommitSamples: number
  maxChangedFiles: number
  workspaceRoot: string
  runId: string
}

export type ExportPaths = {
  jsonPath: string
  markdownPath: string
}
