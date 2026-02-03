const { useEffect, useMemo, useState } = React;

const STORAGE_KEYS = {
  drills: "practicePlanBuilder.drills",
  plans: "practicePlanBuilder.plans",
  draft: "practicePlanBuilder.planDraft",
  theme: "practicePlanBuilder.theme",
};

const PRACTICE_DURATIONS = [
  "30 minutes",
  "45 minutes",
  "50 minutes",
  "60 minutes",
  "75 minutes",
  "90 minutes",
];

const PRACTICE_COACHES = ["Coach 1", "Coach 2", "Coach 3", "Coach 4", "Coach 5"];

const DRILL_CATEGORIES = [
  "Skating",
  "Shooting",
  "Passing",
  "Defensive",
  "Offensive",
  "Other",
];

const SKILL_FOCUS = [...DRILL_CATEGORIES];

const SAMPLE_DRILLS = [
  {
    id: "drill-1",
    name: "Blue Line Passing Warmup",
    category: "Passing",
    duration: "05:00",
    skillFocus: "Passing",
    objective: "Warm up passing accuracy and timing.",
    setup: "Players line up at the blue line with pucks.",
    execution: "Quick touch passes in a box pattern.",
    coachingPoints: "Head up, soft hands, communicate.",
    variations: "One-touch only or add a defender.",
    equipment: "Pucks, cones",
    description: "",
    videoLink: "",
    pdfLink: "",
  },
  {
    id: "drill-2",
    name: "Corner Battle to Net",
    category: "Offensive",
    duration: "07:30",
    skillFocus: "Offensive",
    objective: "Win puck battles and attack the net.",
    setup: "Two players in the corner, coach dumps puck.",
    execution: "Battle for puck then drive to net.",
    coachingPoints: "Strong body position, quick release.",
    variations: "Add a backchecker.",
    equipment: "Pucks",
    description: "",
    videoLink: "",
    pdfLink: "",
  },
];

const createId = () =>
  `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;

const toIsoDate = (date = new Date()) =>
  date.toLocaleDateString("en-CA");

const createPracticeName = () => `Practice - ${toIsoDate()}`;

const createEmptyPlan = () => ({
  name: createPracticeName(),
  description: "",
  date: toIsoDate(),
  duration: PRACTICE_DURATIONS[0],
  location: "Hylo Park Arena",
  coach: PRACTICE_COACHES[0],
  notes: "",
  drills: [],
});

const createEmptyDrill = () => ({
  name: "",
  category: DRILL_CATEGORIES[0],
  duration: "00:30",
  skillFocus: SKILL_FOCUS[0],
  objective: "",
  setup: "",
  execution: "",
  coachingPoints: "",
  variations: "",
  equipment: "",
  description: "",
  videoLink: "",
  pdfLink: "",
});

const loadStorage = (key, fallback) => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
};

const saveStorage = (key, value) => {
  window.localStorage.setItem(key, JSON.stringify(value));
};

const buildDurationOptions = () => {
  const options = [];
  for (let seconds = 30; seconds <= 1800; seconds += 30) {
    const minutesPart = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const secondsPart = (seconds % 60).toString().padStart(2, "0");
    options.push(`${minutesPart}:${secondsPart}`);
  }
  return options;
};

const DRILL_DURATION_OPTIONS = buildDurationOptions();

const updateDocumentTheme = (isDark) => {
  const root = document.documentElement;
  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
};

const exportHtmlAsDoc = (filename, bodyHtml) => {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${bodyHtml}</body></html>`;
  const blob = new Blob([html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const openPrintWindow = (title, bodyHtml) => {
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) return;
  printWindow.document.write(
    `<!DOCTYPE html><html><head><title>${title}</title><style>body{font-family:Arial, sans-serif; padding:24px;} h1,h2{margin:0 0 12px;} section{margin-bottom:24px;} ul{padding-left:18px;}</style></head><body>${bodyHtml}</body></html>`
  );
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};

const buildPlanExportHtml = (plan) => {
  const drillItems = plan.drills
    .map(
      (drill, index) => `
        <section>
          <h3>${index + 1}. ${drill.name || "Untitled Drill"}</h3>
          <p><strong>Duration:</strong> ${drill.duration}</p>
          <p><strong>Equipment:</strong> ${drill.equipment || "None"}</p>
          <p><strong>Objective:</strong> ${drill.objective || ""}</p>
          <p><strong>Setup:</strong> ${drill.setup || ""}</p>
          <p><strong>Execution:</strong> ${drill.execution || ""}</p>
          <p><strong>Coaching Points:</strong> ${drill.coachingPoints || ""}</p>
          <p><strong>Variations:</strong> ${drill.variations || ""}</p>
        </section>
      `
    )
    .join("");

  return `
    <h1>${plan.name}</h1>
    <p><strong>Date:</strong> ${plan.date}</p>
    <p><strong>Duration:</strong> ${plan.duration}</p>
    <p><strong>Location:</strong> ${plan.location}</p>
    <p><strong>Coach:</strong> ${plan.coach}</p>
    <p><strong>Description:</strong> ${plan.description || ""}</p>
    <p><strong>Notes:</strong> ${plan.notes || ""}</p>
    <p><strong>Equipment:</strong> ${plan.equipment || "None"}</p>
    <h2>Practice Drills</h2>
    ${drillItems || "<p>No drills selected.</p>"}
  `;
};

const buildLibraryExportHtml = (drills) => {
  const drillItems = drills
    .map(
      (drill) => `
      <section>
        <h3>${drill.name || "Untitled Drill"}</h3>
        <p><strong>Category:</strong> ${drill.category}</p>
        <p><strong>Duration:</strong> ${drill.duration}</p>
        <p><strong>Skill Focus:</strong> ${drill.skillFocus}</p>
        <p><strong>Objective:</strong> ${drill.objective || ""}</p>
        <p><strong>Setup:</strong> ${drill.setup || ""}</p>
        <p><strong>Execution:</strong> ${drill.execution || ""}</p>
        <p><strong>Coaching Points:</strong> ${drill.coachingPoints || ""}</p>
        <p><strong>Variations:</strong> ${drill.variations || ""}</p>
        <p><strong>Equipment:</strong> ${drill.equipment || ""}</p>
        <p><strong>Video Link:</strong> ${drill.videoLink || ""}</p>
        <p><strong>PDF Link:</strong> ${drill.pdfLink || ""}</p>
        <p><strong>Description:</strong> ${drill.description || ""}</p>
      </section>
    `
    )
    .join("");

  return `
    <h1>Drill Library</h1>
    ${drillItems || "<p>No drills in the library yet.</p>"}
  `;
};

const FieldLabel = ({ children }) => (
  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
    {children}
  </span>
);

const TextInput = ({ className = "", ...props }) => (
  <input
    {...props}
    className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 ${className}`}
  />
);

const TextArea = ({ className = "", ...props }) => (
  <textarea
    {...props}
    className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 ${className}`}
  />
);

const SelectInput = ({ className = "", children, ...props }) => (
  <select
    {...props}
    className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 ${className}`}
  >
    {children}
  </select>
);

const PrimaryButton = ({ className = "", ...props }) => (
  <button
    {...props}
    className={`rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-600 ${className}`}
  />
);

const SecondaryButton = ({ className = "", ...props }) => (
  <button
    {...props}
    className={`rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 ${className}`}
  />
);

const OutlineButton = ({ className = "", ...props }) => (
  <button
    {...props}
    className={`rounded-lg border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 dark:border-indigo-400/50 dark:text-indigo-300 dark:hover:bg-indigo-900/30 ${className}`}
  />
);

const App = () => {
  const [activeView, setActiveView] = useState("plan");
  const [drills, setDrills] = useState(() =>
    loadStorage(STORAGE_KEYS.drills, SAMPLE_DRILLS)
  );
  const [plans, setPlans] = useState(() =>
    loadStorage(STORAGE_KEYS.plans, [])
  );
  const [planDraft, setPlanDraft] = useState(() =>
    loadStorage(STORAGE_KEYS.draft, createEmptyPlan())
  );
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [editingDrill, setEditingDrill] = useState(createEmptyDrill());
  const [editingDrillId, setEditingDrillId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [isDark, setIsDark] = useState(() => {
    const stored = loadStorage(STORAGE_KEYS.theme, null);
    if (stored === null) {
      return window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
        ? true
        : false;
    }
    return stored === "dark";
  });

  useEffect(() => {
    saveStorage(STORAGE_KEYS.drills, drills);
  }, [drills]);

  useEffect(() => {
    saveStorage(STORAGE_KEYS.plans, plans);
  }, [plans]);

  useEffect(() => {
    saveStorage(STORAGE_KEYS.draft, planDraft);
  }, [planDraft]);

  useEffect(() => {
    updateDocumentTheme(isDark);
    saveStorage(STORAGE_KEYS.theme, isDark ? "dark" : "light");
  }, [isDark]);

  const planEquipment = useMemo(() => {
    const equipment = planDraft.drills
      .flatMap((drill) =>
        drill.equipment
          ? drill.equipment.split(",").map((item) => item.trim())
          : []
      )
      .filter(Boolean);
    return Array.from(new Set(equipment)).join(", ");
  }, [planDraft.drills]);

  const handleSelectLibraryDrill = (drill) => {
    setSelectedDetail({ type: "library", id: drill.id });
    setEditingDrillId(null);
    setEditingDrill({ ...drill });
  };

  const handleSelectPlanDrill = (entry) => {
    setSelectedDetail({ type: "plan", id: entry.entryId });
    setEditingDrillId(entry.entryId);
    setEditingDrill({ ...entry });
  };

  const handleAddToPlan = () => {
    if (!editingDrill.name.trim()) return;
    const newEntry = {
      ...editingDrill,
      entryId: createId(),
    };
    setPlanDraft((current) => ({
      ...current,
      drills: [...current.drills, newEntry],
    }));
    setSelectedDetail({ type: "plan", id: newEntry.entryId });
    setEditingDrillId(newEntry.entryId);
    setEditingDrill(newEntry);
  };

  const handleUpdatePlanDrill = () => {
    if (!editingDrillId) return;
    setPlanDraft((current) => ({
      ...current,
      drills: current.drills.map((drill) =>
        drill.entryId === editingDrillId ? { ...editingDrill } : drill
      ),
    }));
  };

  const handleRemovePlanDrill = (entryId) => {
    setPlanDraft((current) => ({
      ...current,
      drills: current.drills.filter((drill) => drill.entryId !== entryId),
    }));
    if (selectedDetail?.id === entryId) {
      setSelectedDetail(null);
      setEditingDrillId(null);
      setEditingDrill(createEmptyDrill());
    }
  };

  const handleDragStart = (entryId) => {
    setDraggingId(entryId);
  };

  const handleDrop = (entryId) => {
    if (!draggingId || draggingId === entryId) return;
    setPlanDraft((current) => {
      const drillsCopy = [...current.drills];
      const fromIndex = drillsCopy.findIndex(
        (drill) => drill.entryId === draggingId
      );
      const toIndex = drillsCopy.findIndex(
        (drill) => drill.entryId === entryId
      );
      if (fromIndex === -1 || toIndex === -1) return current;
      const [moved] = drillsCopy.splice(fromIndex, 1);
      drillsCopy.splice(toIndex, 0, moved);
      return { ...current, drills: drillsCopy };
    });
    setDraggingId(null);
  };

  const handleSavePlan = () => {
    if (!planDraft.name.trim()) return;
    const newPlan = {
      ...planDraft,
      id: createId(),
      savedAt: new Date().toISOString(),
      equipment: planEquipment,
    };
    setPlans((current) => [newPlan, ...current]);
    setPlanDraft(createEmptyPlan());
    setSelectedDetail(null);
    setEditingDrillId(null);
    setEditingDrill(createEmptyDrill());
  };

  const handleLoadPlan = (plan) => {
    setPlanDraft({
      ...plan,
      drills: plan.drills.map((drill) => ({ ...drill })),
    });
    setActiveView("plan");
    setSelectedDetail(null);
    setEditingDrillId(null);
    setEditingDrill(createEmptyDrill());
  };

  const handleResetPlan = () => {
    setPlanDraft(createEmptyPlan());
    setSelectedDetail(null);
    setEditingDrillId(null);
    setEditingDrill(createEmptyDrill());
  };

  const handleCreateNewDrill = () => {
    setEditingDrill(createEmptyDrill());
    setEditingDrillId(null);
    setSelectedDetail({ type: "library", id: null });
  };

  const handleSaveDrill = () => {
    if (!editingDrill.name.trim()) return;
    if (editingDrillId) {
      setDrills((current) =>
        current.map((drill) =>
          drill.id === editingDrillId ? { ...editingDrill, id: drill.id } : drill
        )
      );
    } else {
      setDrills((current) => [
        { ...editingDrill, id: createId() },
        ...current,
      ]);
    }
    setEditingDrill(createEmptyDrill());
    setEditingDrillId(null);
    setSelectedDetail(null);
  };

  const handleSelectDrillInLibrary = (drill) => {
    setSelectedDetail({ type: "library", id: drill.id });
    setEditingDrillId(drill.id);
    setEditingDrill({ ...drill });
  };

  const handleExportPlan = (plan, type) => {
    const html = buildPlanExportHtml({
      ...plan,
      equipment: plan.equipment || planEquipment,
    });
    if (type === "word") {
      exportHtmlAsDoc(`${plan.name || "practice-plan"}.doc`, html);
    } else {
      openPrintWindow(plan.name || "Practice Plan", html);
    }
  };

  const handleExportLibrary = (type) => {
    const html = buildLibraryExportHtml(drills);
    if (type === "word") {
      exportHtmlAsDoc("drill-library.doc", html);
    } else {
      openPrintWindow("Drill Library", html);
    }
  };

  const detailTitle = selectedDetail?.type === "plan" ? "Plan Drill" : "Drill";

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-900">
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white px-6 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 md:flex">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">
            Practice Builder
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            Hockey Plans
          </h1>
        </div>
        <nav className="flex flex-1 flex-col gap-2">
          {[
            { id: "plan", label: "Create practice plan" },
            { id: "library", label: "View drills library" },
            { id: "saved", label: "Previous plans" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${
                activeView === item.id
                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-200"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <p>Save your plans locally on this device.</p>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">
              {activeView === "plan"
                ? "Plan Builder"
                : activeView === "library"
                ? "Drill Library"
                : "Practice Plans"}
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
              {activeView === "plan"
                ? "Build a new practice plan"
                : activeView === "library"
                ? "Browse and manage drills"
                : "Review saved plans"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <SecondaryButton onClick={() => setIsDark((current) => !current)}>
              {isDark ? "Light mode" : "Dark mode"}
            </SecondaryButton>
            <SecondaryButton
              onClick={() =>
                setActiveView(
                  activeView === "plan"
                    ? "library"
                    : activeView === "library"
                    ? "saved"
                    : "plan"
                )
              }
              className="md:hidden"
            >
              Switch view
            </SecondaryButton>
          </div>
        </header>

        <section className="flex flex-1 gap-6 overflow-hidden p-6">
          {activeView === "plan" && (
            <div className="grid h-full flex-1 grid-cols-1 gap-6 overflow-hidden lg:grid-cols-[1.2fr_0.8fr]">
              <div className="flex h-full flex-col gap-6 overflow-hidden">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-950">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      Practice details
                    </h3>
                    <OutlineButton onClick={handleResetPlan}>
                      Start new plan
                    </OutlineButton>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <FieldLabel>Practice Name</FieldLabel>
                      <TextInput
                        value={planDraft.name}
                        onChange={(event) =>
                          setPlanDraft((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>Practice Date</FieldLabel>
                      <TextInput
                        type="date"
                        value={planDraft.date}
                        onChange={(event) =>
                          setPlanDraft((current) => ({
                            ...current,
                            date: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>Practice Duration</FieldLabel>
                      <SelectInput
                        value={planDraft.duration}
                        onChange={(event) =>
                          setPlanDraft((current) => ({
                            ...current,
                            duration: event.target.value,
                          }))
                        }
                      >
                        {PRACTICE_DURATIONS.map((duration) => (
                          <option key={duration} value={duration}>
                            {duration}
                          </option>
                        ))}
                      </SelectInput>
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>Practice Location</FieldLabel>
                      <TextInput
                        value={planDraft.location}
                        onChange={(event) =>
                          setPlanDraft((current) => ({
                            ...current,
                            location: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>Practice Coach</FieldLabel>
                      <SelectInput
                        value={planDraft.coach}
                        onChange={(event) =>
                          setPlanDraft((current) => ({
                            ...current,
                            coach: event.target.value,
                          }))
                        }
                      >
                        {PRACTICE_COACHES.map((coach) => (
                          <option key={coach} value={coach}>
                            {coach}
                          </option>
                        ))}
                      </SelectInput>
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>Practice Equipment</FieldLabel>
                      <TextInput value={planEquipment} readOnly />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <FieldLabel>Practice Description</FieldLabel>
                      <TextArea
                        rows={3}
                        value={planDraft.description}
                        onChange={(event) =>
                          setPlanDraft((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <FieldLabel>Practice Notes</FieldLabel>
                      <TextArea
                        rows={3}
                        value={planDraft.notes}
                        onChange={(event) =>
                          setPlanDraft((current) => ({
                            ...current,
                            notes: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="grid flex-1 grid-cols-1 gap-6 overflow-hidden xl:grid-cols-2">
                  <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-950">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      Drill library
                    </h3>
                    <p className="text-sm text-slate-500">
                      Select a drill to customize before adding it to the plan.
                    </p>
                    <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-2 scrollbar-thin">
                      {drills.map((drill) => (
                        <button
                          key={drill.id}
                          onClick={() => handleSelectLibraryDrill(drill)}
                          className="flex w-full flex-col rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-800 dark:hover:border-indigo-600 dark:hover:bg-indigo-900/30"
                        >
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">
                            {drill.name}
                          </span>
                          <span className="text-xs text-slate-500">
                            {drill.category} • {drill.duration}
                          </span>
                        </button>
                      ))}
                      {drills.length === 0 && (
                        <p className="text-sm text-slate-500">
                          No drills yet. Add one in the library view.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-950">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                          Practice drills
                        </h3>
                        <p className="text-sm text-slate-500">
                          Drag and drop to reorder.
                        </p>
                      </div>
                      <PrimaryButton onClick={handleSavePlan}>
                        Save plan
                      </PrimaryButton>
                    </div>
                    <div className="flex-1 space-y-3 overflow-y-auto pr-2 scrollbar-thin">
                      {planDraft.drills.map((entry) => (
                        <div
                          key={entry.entryId}
                          draggable
                          onDragStart={() => handleDragStart(entry.entryId)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => handleDrop(entry.entryId)}
                          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                            selectedDetail?.id === entry.entryId
                              ? "border-indigo-400 bg-indigo-50 dark:border-indigo-600 dark:bg-indigo-900/30"
                              : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                          }`}
                        >
                          <button
                            className="flex flex-1 flex-col text-left"
                            onClick={() => handleSelectPlanDrill(entry)}
                          >
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                              {entry.name || "Untitled drill"}
                            </span>
                            <span className="text-xs text-slate-500">
                              {entry.duration} • {entry.equipment || "No equipment"}
                            </span>
                          </button>
                          <button
                            onClick={() => handleRemovePlanDrill(entry.entryId)}
                            className="ml-3 rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 hover:border-rose-200 hover:text-rose-500 dark:border-slate-700"
                          >
                            x
                          </button>
                        </div>
                      ))}
                      {planDraft.drills.length === 0 && (
                        <p className="text-sm text-slate-500">
                          Add drills from the library to build your plan.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <aside className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-950">
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">
                    {detailTitle}
                  </p>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {editingDrill.name || "Select a drill"}
                  </h3>
                  <p className="text-sm text-slate-500">
                    Customize details and add to the plan or update an existing
                    entry.
                  </p>
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-thin">
                  <div className="space-y-2">
                    <FieldLabel>Drill Name</FieldLabel>
                    <TextInput
                      value={editingDrill.name}
                      onChange={(event) =>
                        setEditingDrill((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Drill Category</FieldLabel>
                    <SelectInput
                      value={editingDrill.category}
                      onChange={(event) =>
                        setEditingDrill((current) => ({
                          ...current,
                          category: event.target.value,
                        }))
                      }
                    >
                      {DRILL_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </SelectInput>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Duration</FieldLabel>
                    <SelectInput
                      value={editingDrill.duration}
                      onChange={(event) =>
                        setEditingDrill((current) => ({
                          ...current,
                          duration: event.target.value,
                        }))
                      }
                    >
                      {DRILL_DURATION_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </SelectInput>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Skill Focus</FieldLabel>
                    <SelectInput
                      value={editingDrill.skillFocus}
                      onChange={(event) =>
                        setEditingDrill((current) => ({
                          ...current,
                          skillFocus: event.target.value,
                        }))
                      }
                    >
                      {SKILL_FOCUS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </SelectInput>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Objective</FieldLabel>
                    <TextArea
                      rows={2}
                      value={editingDrill.objective}
                      onChange={(event) =>
                        setEditingDrill((current) => ({
                          ...current,
                          objective: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Setup</FieldLabel>
                    <TextArea
                      rows={2}
                      value={editingDrill.setup}
                      onChange={(event) =>
                        setEditingDrill((current) => ({
                          ...current,
                          setup: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Execution</FieldLabel>
                    <TextArea
                      rows={2}
                      value={editingDrill.execution}
                      onChange={(event) =>
                        setEditingDrill((current) => ({
                          ...current,
                          execution: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Coaching Points</FieldLabel>
                    <TextArea
                      rows={2}
                      value={editingDrill.coachingPoints}
                      onChange={(event) =>
                        setEditingDrill((current) => ({
                          ...current,
                          coachingPoints: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Variations</FieldLabel>
                    <TextArea
                      rows={2}
                      value={editingDrill.variations}
                      onChange={(event) =>
                        setEditingDrill((current) => ({
                          ...current,
                          variations: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Equipment</FieldLabel>
                    <TextArea
                      rows={2}
                      value={editingDrill.equipment}
                      onChange={(event) =>
                        setEditingDrill((current) => ({
                          ...current,
                          equipment: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <PrimaryButton
                    className="flex-1"
                    onClick={
                      selectedDetail?.type === "plan"
                        ? handleUpdatePlanDrill
                        : handleAddToPlan
                    }
                  >
                    {selectedDetail?.type === "plan"
                      ? "Update plan drill"
                      : "Add to plan"}
                  </PrimaryButton>
                </div>
              </aside>
            </div>
          )}

          {activeView === "library" && (
            <div className="grid h-full flex-1 grid-cols-1 gap-6 overflow-hidden lg:grid-cols-[1fr_1fr]">
              <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-950">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      Drill library
                    </h3>
                    <p className="text-sm text-slate-500">
                      Browse existing drills or create a new one.
                    </p>
                  </div>
                  <OutlineButton onClick={handleCreateNewDrill}>
                    Create new drill
                  </OutlineButton>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto pr-2 scrollbar-thin">
                  {drills.map((drill) => (
                    <button
                      key={drill.id}
                      onClick={() => handleSelectDrillInLibrary(drill)}
                      className="flex w-full flex-col rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-800 dark:hover:border-indigo-600 dark:hover:bg-indigo-900/30"
                    >
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {drill.name}
                      </span>
                      <span className="text-xs text-slate-500">
                        {drill.category} • {drill.duration}
                      </span>
                    </button>
                  ))}
                  {drills.length === 0 && (
                    <p className="text-sm text-slate-500">
                      No drills yet. Create your first drill.
                    </p>
                  )}
                </div>
                <div className="mt-4 flex gap-2">
                  <SecondaryButton onClick={() => handleExportLibrary("print")}>
                    Print / PDF
                  </SecondaryButton>
                  <SecondaryButton onClick={() => handleExportLibrary("word")}>
                    Export Word
                  </SecondaryButton>
                </div>
              </div>

              <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-950">
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">
                    Drill Details
                  </p>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {editingDrillId ? "Edit drill" : "New drill"}
                  </h3>
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-thin">
                  <div className="space-y-2">
                    <FieldLabel>Drill Name</FieldLabel>
                    <TextInput
                      value={editingDrill.name}
                      onChange={(event) =>
                        setEditingDrill((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <FieldLabel>Drill Category</FieldLabel>
                      <SelectInput
                        value={editingDrill.category}
                        onChange={(event) =>
                          setEditingDrill((current) => ({
                            ...current,
                            category: event.target.value,
                          }))
                        }
                      >
                        {DRILL_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </SelectInput>
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>Skill Focus</FieldLabel>
                      <SelectInput
                        value={editingDrill.skillFocus}
                        onChange={(event) =>
                          setEditingDrill((current) => ({
                            ...current,
                            skillFocus: event.target.value,
                          }))
                        }
                      >
                        {SKILL_FOCUS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </SelectInput>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Duration</FieldLabel>
                    <SelectInput
                      value={editingDrill.duration}
                      onChange={(event) =>
                        setEditingDrill((current) => ({
                          ...current,
                          duration: event.target.value,
                        }))
                      }
                    >
                      {DRILL_DURATION_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </SelectInput>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Objective</FieldLabel>
                    <TextArea
                      rows={2}
                      value={editingDrill.objective}
                      onChange={(event) =>
                        setEditingDrill((current) => ({
                          ...current,
                          objective: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Setup</FieldLabel>
                    <TextArea
                      rows={2}
                      value={editingDrill.setup}
                      onChange={(event) =>
                        setEditingDrill((current) => ({
                          ...current,
                          setup: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Execution</FieldLabel>
                    <TextArea
                      rows={2}
                      value={editingDrill.execution}
                      onChange={(event) =>
                        setEditingDrill((current) => ({
                          ...current,
                          execution: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Coaching Points</FieldLabel>
                    <TextArea
                      rows={2}
                      value={editingDrill.coachingPoints}
                      onChange={(event) =>
                        setEditingDrill((current) => ({
                          ...current,
                          coachingPoints: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Variations</FieldLabel>
                    <TextArea
                      rows={2}
                      value={editingDrill.variations}
                      onChange={(event) =>
                        setEditingDrill((current) => ({
                          ...current,
                          variations: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Equipment</FieldLabel>
                    <TextArea
                      rows={2}
                      value={editingDrill.equipment}
                      onChange={(event) =>
                        setEditingDrill((current) => ({
                          ...current,
                          equipment: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Description</FieldLabel>
                    <TextArea
                      rows={2}
                      value={editingDrill.description}
                      onChange={(event) =>
                        setEditingDrill((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Video Link</FieldLabel>
                    <TextInput
                      value={editingDrill.videoLink}
                      onChange={(event) =>
                        setEditingDrill((current) => ({
                          ...current,
                          videoLink: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>PDF Link</FieldLabel>
                    <TextInput
                      value={editingDrill.pdfLink}
                      onChange={(event) =>
                        setEditingDrill((current) => ({
                          ...current,
                          pdfLink: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <PrimaryButton className="flex-1" onClick={handleSaveDrill}>
                    Save drill
                  </PrimaryButton>
                </div>
              </div>
            </div>
          )}

          {activeView === "saved" && (
            <div className="flex h-full flex-1 flex-col gap-6 overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Saved practice plans
                  </h3>
                  <p className="text-sm text-slate-500">
                    Open a plan to export, print, or continue editing.
                  </p>
                </div>
              </div>
              <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto pr-2 scrollbar-thin lg:grid-cols-2">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
                          {plan.name}
                        </h4>
                        <p className="text-sm text-slate-500">
                          {plan.date} • {plan.duration}
                        </p>
                      </div>
                      <OutlineButton onClick={() => handleLoadPlan(plan)}>
                        Load
                      </OutlineButton>
                    </div>
                    <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                      {plan.description || "No description added yet."}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>{plan.drills.length} drills</span>
                      <span>Location: {plan.location}</span>
                      <span>Coach: {plan.coach}</span>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <SecondaryButton onClick={() => handleExportPlan(plan, "print")}>
                        Print / PDF
                      </SecondaryButton>
                      <SecondaryButton onClick={() => handleExportPlan(plan, "word")}>
                        Export Word
                      </SecondaryButton>
                    </div>
                  </div>
                ))}
                {plans.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950">
                    No saved plans yet. Build and save a practice plan to see it
                    here.
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
