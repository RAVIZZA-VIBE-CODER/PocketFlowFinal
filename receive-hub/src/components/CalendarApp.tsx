import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, Plus, Save, Trash2 } from "lucide-react";
import {
  LifeCalendarEvent,
  addDays,
  deleteCalendarEvent,
  formatLifeDate,
  labelLifeDate,
  loadCalendarEvents,
  upsertCalendarEvent,
} from "../utils/lifeMemory";

interface CalendarAppProps {
  onNotify?: (message: string, type: "success" | "info" | "warn") => void;
}

const emptyDraft = () => ({
  id: "",
  title: "",
  date: formatLifeDate(new Date()),
  time: "12:00",
  notes: "",
});

export default function CalendarApp({ onNotify }: CalendarAppProps) {
  const [events, setEvents] = useState<LifeCalendarEvent[]>(loadCalendarEvents);
  const [selectedDate, setSelectedDate] = useState(formatLifeDate(new Date()));
  const [draft, setDraft] = useState(emptyDraft);

  const refresh = () => setEvents(loadCalendarEvents());

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("pocketflow-life-memory-updated", handler);
    return () => window.removeEventListener("pocketflow-life-memory-updated", handler);
  }, []);

  const selectedEvents = useMemo(
    () => events.filter((event) => event.date === selectedDate).sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99")),
    [events, selectedDate],
  );
  const upcomingEvents = useMemo(
    () => events.filter((event) => event.date >= formatLifeDate(new Date())).slice(0, 6),
    [events],
  );

  const saveDraft = () => {
    if (!draft.title.trim()) {
      onNotify?.("Add a calendar title first.", "warn");
      return;
    }
    const saved = upsertCalendarEvent({
      id: draft.id || undefined,
      title: draft.title.trim(),
      date: draft.date,
      time: draft.time,
      notes: draft.notes.trim(),
      source: "manual",
    });
    refresh();
    setSelectedDate(saved.date);
    setDraft(emptyDraft());
    onNotify?.("Calendar event saved.", "success");
  };

  const editEvent = (event: LifeCalendarEvent) => {
    setDraft({
      id: event.id,
      title: event.title,
      date: event.date,
      time: event.time || "12:00",
      notes: event.notes,
    });
    setSelectedDate(event.date);
  };

  const removeEvent = (id: string) => {
    deleteCalendarEvent(id);
    refresh();
    if (draft.id === id) setDraft(emptyDraft());
    onNotify?.("Calendar event removed.", "info");
  };

  return (
    <div className="pocketflow-screen-scroll flex-1 min-h-0 min-w-0 flex flex-col pt-4 pb-6 px-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-[#22c55e]" />
            <h1 className="text-xl font-bold text-white">Calendar</h1>
          </div>
          <p className="text-[9px] font-mono uppercase tracking-[0.22em] text-[#8e9299] truncate">
            Baloss LLM plans and manual schedule
          </p>
        </div>
        <div className="px-3 py-1.5 rounded-full border border-[#22c55e]/25 bg-[#22c55e]/10 text-[#22c55e] text-[9px] font-mono font-bold uppercase tracking-widest">
          {events.length} events
        </div>
      </div>

      <section className="bg-[#151619] border border-[#2a2c32] rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center gap-2 border-b border-[#2a2c32] pb-2">
          <Plus className="w-4 h-4 text-amber-400" />
          <h2 className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-300">
            {draft.id ? "Edit Event" : "New Event"}
          </h2>
        </div>
        <input
          value={draft.title}
          onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))}
          placeholder="Appointment, call, task..."
          className="w-full bg-[#0c0c0d] border border-[#2a2c32] rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={draft.date}
            onChange={(event) => setDraft((value) => ({ ...value, date: event.target.value }))}
            className="min-w-0 bg-[#0c0c0d] border border-[#2a2c32] rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none"
          />
          <input
            type="time"
            value={draft.time}
            onChange={(event) => setDraft((value) => ({ ...value, time: event.target.value }))}
            className="min-w-0 bg-[#0c0c0d] border border-[#2a2c32] rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none"
          />
        </div>
        <textarea
          value={draft.notes}
          onChange={(event) => setDraft((value) => ({ ...value, notes: event.target.value }))}
          placeholder="Notes, place, contact, preparation..."
          rows={3}
          className="w-full bg-[#0c0c0d] border border-[#2a2c32] rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none resize-none"
        />
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <button onClick={saveDraft} className="h-11 rounded-xl bg-[#22c55e] text-black text-[10px] font-mono font-bold uppercase tracking-widest flex items-center justify-center gap-2">
            <Save className="w-4 h-4" /> Save Event
          </button>
          {draft.id && (
            <button onClick={() => setDraft(emptyDraft())} className="h-11 px-4 rounded-xl border border-[#2a2c32] text-slate-300 text-[10px] font-mono font-bold uppercase">
              New
            </button>
          )}
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2">
        {[formatLifeDate(new Date()), formatLifeDate(addDays(new Date(), 1)), formatLifeDate(addDays(new Date(), 2))].map((date) => (
          <button
            key={date}
            onClick={() => setSelectedDate(date)}
            className={`rounded-xl border px-2 py-3 text-left ${selectedDate === date ? "border-[#22c55e]/40 bg-[#22c55e]/10" : "border-[#2a2c32] bg-[#151619]"}`}
          >
            <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">{labelLifeDate(date)}</div>
            <div className="text-xs font-bold text-slate-100">{date.slice(5)}</div>
          </button>
        ))}
      </div>

      <section className="bg-[#151619] border border-[#2a2c32] rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center gap-2 border-b border-[#2a2c32] pb-2">
          <Clock className="w-4 h-4 text-[#22c55e]" />
          <h2 className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-300">
            {labelLifeDate(selectedDate)} Schedule
          </h2>
        </div>
        <div className="space-y-2">
          {selectedEvents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#2a2c32] p-4 text-xs text-slate-500">No events for this day.</div>
          ) : (
            selectedEvents.map((event) => (
              <div key={event.id} className="rounded-xl border border-[#2a2c32] bg-[#0c0c0d] p-3 space-y-2">
                <button onClick={() => editEvent(event)} className="w-full text-left">
                  <div className="text-[10px] font-mono text-[#22c55e]">{event.time || "All day"} / {event.source}</div>
                  <div className="text-sm font-bold text-white">{event.title}</div>
                  {event.notes && <div className="text-[10px] text-slate-400 mt-1 leading-relaxed">{event.notes}</div>}
                </button>
                <button onClick={() => removeEvent(event.id)} className="h-8 px-3 rounded-lg border border-red-500/20 text-red-400 bg-red-500/10 text-[9px] font-mono font-bold uppercase flex items-center gap-1">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="bg-[#151619] border border-[#2a2c32] rounded-2xl p-4 shadow-xl space-y-2">
        <h2 className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-300">Upcoming</h2>
        {upcomingEvents.length === 0 ? (
          <div className="text-xs text-slate-500">No upcoming events yet.</div>
        ) : (
          upcomingEvents.map((event) => (
            <button key={event.id} onClick={() => editEvent(event)} className="w-full rounded-xl border border-[#2a2c32] bg-[#0c0c0d] p-3 text-left">
              <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">{labelLifeDate(event.date)} / {event.time || "all day"}</div>
              <div className="text-xs font-bold text-slate-100">{event.title}</div>
            </button>
          ))
        )}
      </section>
    </div>
  );
}
