import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Issue } from "@multica/core/types";
import { I18nProvider } from "@multica/core/i18n/react";
import { createIssueViewStore } from "@multica/core/issues/stores/view-store";
import { ViewStoreProvider } from "@multica/core/issues/stores/view-store-context";
import enCommon from "../../locales/en/common.json";
import enIssues from "../../locales/en/issues.json";
import enProjects from "../../locales/en/projects.json";

// ---------------------------------------------------------------------------
// Regression test for AND-5191: the project working-only filter must apply
// to project-scoped issues. The previous implementation wired the chip to
// the global /issues view store and never plumbed agentRunningFilter through
// project-side filterIssues, so toggling did nothing in the project view.
// ---------------------------------------------------------------------------

vi.mock("@multica/core/hooks", () => ({
  useWorkspaceId: () => "ws-1",
}));

vi.mock("../../navigation", () => ({
  AppLink: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useNavigation: () => ({ push: vi.fn(), pathname: "/projects/p-1" }),
  NavigationProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Each view component (BoardView/ListView/etc.) is mocked to dump just the
// issue titles it receives. That makes the assertion direct: did the
// filtered `issues` prop honour the working filter?
vi.mock("../../issues/components/board-view", () => ({
  BoardView: ({ issues }: { issues: Issue[] }) => (
    <div data-testid="board-view">
      {issues.map((i) => (
        <span key={i.id} data-testid="issue-title">
          {i.title}
        </span>
      ))}
    </div>
  ),
}));
vi.mock("../../issues/components/list-view", () => ({
  ListView: ({ issues }: { issues: Issue[] }) => (
    <div data-testid="list-view">
      {issues.map((i) => (
        <span key={i.id} data-testid="issue-title">
          {i.title}
        </span>
      ))}
    </div>
  ),
}));
vi.mock("../../issues/components/swimlane-view", () => ({
  SwimLaneView: ({ issues }: { issues: Issue[] }) => (
    <div data-testid="swimlane-view">
      {issues.map((i) => (
        <span key={i.id} data-testid="issue-title">
          {i.title}
        </span>
      ))}
    </div>
  ),
}));
vi.mock("../../issues/components/gantt-view", () => ({
  GanttView: ({ issues }: { issues: Issue[] }) => (
    <div data-testid="gantt-view">
      {issues.map((i) => (
        <span key={i.id} data-testid="issue-title">
          {i.title}
        </span>
      ))}
    </div>
  ),
}));
vi.mock("../../issues/components/batch-action-toolbar", () => ({
  BatchActionToolbar: () => null,
}));

// Stub heavy queries that ProjectIssuesContent / IssuesHeader pull in.
vi.mock("@multica/core/issues/queries", async () => {
  const actual = await vi.importActual<
    typeof import("@multica/core/issues/queries")
  >("@multica/core/issues/queries");
  return {
    ...actual,
    childIssueProgressOptions: () => ({
      queryKey: ["childProgress"],
      queryFn: async () => new Map(),
    }),
  };
});
vi.mock("@multica/core/projects/queries", () => ({
  projectListOptions: () => ({
    queryKey: ["projects"],
    queryFn: async () => [],
  }),
}));
vi.mock("@multica/core/labels/queries", () => ({
  labelListOptions: () => ({
    queryKey: ["labels"],
    queryFn: async () => [],
  }),
}));
vi.mock("@multica/core/workspace/queries", () => ({
  memberListOptions: () => ({
    queryKey: ["members"],
    queryFn: async () => [],
  }),
  agentListOptions: () => ({
    queryKey: ["agents"],
    queryFn: async () => [],
  }),
  squadListOptions: () => ({
    queryKey: ["squads"],
    queryFn: async () => [],
  }),
}));
vi.mock("@multica/core/agents", () => ({
  agentTaskSnapshotOptions: () => ({
    queryKey: ["agent-snapshot"],
    queryFn: async () => [],
  }),
}));
vi.mock("@multica/core/issues/mutations", () => ({
  useUpdateIssue: () => ({ mutate: vi.fn() }),
}));
vi.mock("@multica/core/modals", () => ({
  useModalStore: Object.assign(
    () => ({ open: vi.fn() }),
    { getState: () => ({ open: vi.fn() }) },
  ),
}));
vi.mock("@multica/core/issues/stores/issues-scope-store", () => ({
  useIssuesScopeStore: Object.assign(
    (selector?: any) => {
      const state = { scope: "all", setScope: vi.fn() };
      return selector ? selector(state) : state;
    },
    { getState: () => ({ scope: "all", setScope: vi.fn() }) },
  ),
}));

// IssuesHeader pulls in i18n hooks etc., but for the regression check we
// only need the chip's behavior so we keep it mounted via dynamic import.

import {
  __TEST_ONLY_ProjectIssuesContent as ProjectIssuesContent,
} from "./project-detail";

const TEST_RESOURCES = {
  en: { common: enCommon, issues: enIssues, projects: enProjects },
};

function makeIssue(overrides: Partial<Issue>): Issue {
  return {
    id: overrides.id ?? "i-1",
    workspace_id: "ws-1",
    number: 1,
    identifier: "MUL-1",
    title: overrides.title ?? "Issue",
    description: null,
    status: "todo",
    priority: "medium",
    assignee_type: null,
    assignee_id: null,
    creator_type: "member",
    creator_id: "user-1",
    parent_issue_id: null,
    project_id: "p-1",
    position: 0,
    start_date: null,
    due_date: null,
    metadata: {},
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderContent({
  store,
  projectIssues,
  runningIssueIds,
}: {
  store: ReturnType<typeof createIssueViewStore>;
  projectIssues: Issue[];
  runningIssueIds: ReadonlySet<string>;
}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <I18nProvider locale="en" resources={TEST_RESOURCES}>
      <QueryClientProvider client={qc}>
        <ViewStoreProvider store={store}>
          <ProjectIssuesContent
            projectId="p-1"
            projectIssues={projectIssues}
            scope="project:p-1"
            filter={{ project_id: "p-1" }}
            ganttIssues={[]}
            runningIssueIds={runningIssueIds}
          />
        </ViewStoreProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

describe("ProjectIssuesContent — working filter", () => {
  let store: ReturnType<typeof createIssueViewStore>;

  beforeEach(() => {
    store = createIssueViewStore("test-project-view");
    act(() => {
      store.setState({
        viewMode: "board",
        grouping: "status",
        statusFilters: [],
        priorityFilters: [],
        assigneeFilters: [],
        includeNoAssignee: false,
        creatorFilters: [],
        projectFilters: [],
        includeNoProject: false,
        labelFilters: [],
        agentRunningFilter: false,
      });
    });
  });

  it("shows every project issue when the working filter is off", () => {
    renderContent({
      store,
      projectIssues: [
        makeIssue({ id: "a", title: "Issue A" }),
        makeIssue({ id: "b", title: "Issue B" }),
        makeIssue({ id: "c", title: "Issue C" }),
      ],
      runningIssueIds: new Set(["a"]),
    });
    const titles = screen
      .getAllByTestId("issue-title")
      .map((node) => node.textContent);
    expect(titles).toEqual(["Issue A", "Issue B", "Issue C"]);
  });

  it("keeps only project issues with a running agent when the filter is on", () => {
    renderContent({
      store,
      projectIssues: [
        makeIssue({ id: "a", title: "Issue A" }),
        makeIssue({ id: "b", title: "Issue B" }),
        makeIssue({ id: "c", title: "Issue C" }),
      ],
      runningIssueIds: new Set(["b"]),
    });
    act(() => {
      store.getState().toggleAgentRunningFilter();
    });
    const titles = screen
      .getAllByTestId("issue-title")
      .map((node) => node.textContent);
    expect(titles).toEqual(["Issue B"]);
  });

  it("hides every issue when the filter is on but nothing is running", () => {
    renderContent({
      store,
      projectIssues: [
        makeIssue({ id: "a", title: "Issue A" }),
        makeIssue({ id: "b", title: "Issue B" }),
      ],
      runningIssueIds: new Set<string>(),
    });
    act(() => {
      store.getState().toggleAgentRunningFilter();
    });
    expect(screen.queryAllByTestId("issue-title")).toHaveLength(0);
  });
});
