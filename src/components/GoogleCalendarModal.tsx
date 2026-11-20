/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Calendar Interactive Scheduling Modal
 * Displays an interactive calendar with today jump, month navigation,
 * shoot milestone presets, and 1-click "Add to Google Calendar" template dispatch.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  FileText,
  ExternalLink,
  Plus,
  CheckCircle2,
  Sparkles,
  Video,
} from 'lucide-react';
import {
  googleCalendarEngine,
  CalendarEventParams,
  ShootMilestonePreset,
} from '../services/googleCalendarEngine';
import { notificationEngine } from '../services/notificationEngine';
import { useTranslation } from '../i18n';

interface GoogleCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
  heroCount?: number;
  driveFolderUrl?: string;
}

export const GoogleCalendarModal: React.FC<GoogleCalendarModalProps> = ({
  isOpen,
  onClose,
  projectName = 'Drive Therapy Production',
  heroCount = 0,
  driveFolderUrl = 'https://drive.google.com',
}) => {
  const { t } = useTranslation();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [eventTitle, setEventTitle] = useState(() => `${projectName} — Client Review`);
  const [startTime, setStartTime] = useState('14:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [location, setLocation] = useState('Google Meet');
  const [description, setDescription] = useState(
    () => `Client delivery review session for ${projectName}.\n${heroCount} approved hero picks.\nGoogle Drive: ${driveFolderUrl}`
  );
  const [isSuccessToast, setIsSuccessToast] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEventTitle(`${projectName} — Client Review`);
      setDescription(
        `Client delivery review session for ${projectName}.\n${heroCount} approved hero picks.\nGoogle Drive: ${driveFolderUrl}`
      );
    }
  }, [isOpen, projectName, heroCount, driveFolderUrl]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleJumpToToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  };

  const handleSelectDay = (day: number) => {
    const next = new Date(year, month, day);
    setSelectedDate(next);
  };

  const handleApplyPreset = (preset: ShootMilestonePreset) => {
    setEventTitle(preset.name);
    setDurationMinutes(preset.durationMinutes || 60);
    setDescription(preset.descriptionTemplate);
  };

  const handleAddToGoogleCalendar = () => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const start = new Date(selectedDate);
    start.setHours(hours || 14, minutes || 0, 0, 0);

    const end = new Date(start.getTime() + durationMinutes * 60000);

    const eventParams: CalendarEventParams = {
      title: eventTitle,
      startDate: start,
      endDate: end,
      location: location,
      description: description,
    };

    googleCalendarEngine.openGoogleCalendarEvent(eventParams);

    notificationEngine.add({
      title: 'Google Calendar Event Dispatched',
      description: `Scheduled "${eventTitle}" for ${selectedDate.toLocaleDateString()}`,
      flag: 'complete',
      category: 'sync',
    });

    setIsSuccessToast(true);
    setTimeout(() => setIsSuccessToast(false), 3000);
  };

  const isToday = (day: number) => {
    const now = new Date();
    return now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
  };

  const isSelected = (day: number) => {
    return (
      selectedDate.getFullYear() === year &&
      selectedDate.getMonth() === month &&
      selectedDate.getDate() === day
    );
  };

  const presets = googleCalendarEngine.getShootMilestonePresets(projectName, heroCount);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Google Calendar Scheduler"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none"
    >
      <div
        className="relative w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text)',
        }}
      >
        {/* Modal Header */}
        <div
          className="px-5 py-3.5 border-b flex items-center justify-between shrink-0"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#1074B1] text-white flex items-center justify-center shadow-xs">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">Google Calendar & Production Schedule</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#1074B1]/10 text-[#1074B1] border border-[#1074B1]/20">
                  Google Workspace
                </span>
              </div>
              <p className="text-xs opacity-70">
                {selectedDate.toLocaleDateString(undefined, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => googleCalendarEngine.openMainGoogleCalendar()}
              className="px-2.5 py-1 rounded-xl text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-1 opacity-80 hover:opacity-100"
              title="Open Google Calendar web app"
            >
              <span>calendar.google.com</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors"
              aria-label="Close Calendar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Calendar Month Navigation & Grid */}
          <div
            className="p-4 rounded-2xl border"
            style={{
              backgroundColor: 'var(--theme-surface-sunken, rgba(0,0,0,0.02))',
              borderColor: 'var(--theme-border)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold">
                  {monthNames[month]} {year}
                </h3>
                <button
                  onClick={handleJumpToToday}
                  className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[#1074B1]/10 text-[#1074B1] hover:bg-[#1074B1]/20 transition-colors"
                >
                  Today
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors"
                  aria-label="Previous Month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors"
                  aria-label="Next Month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Weekday Labels */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase opacity-60 mb-1">
              <div>Su</div>
              <div>Mo</div>
              <div>Tu</div>
              <div>We</div>
              <div>Th</div>
              <div>Fr</div>
              <div>Sa</div>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty_${i}`} className="h-8" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const active = isSelected(dayNum);
                const current = isToday(dayNum);

                return (
                  <button
                    key={`day_${dayNum}`}
                    onClick={() => handleSelectDay(dayNum)}
                    className={`h-8 rounded-xl text-xs font-semibold flex items-center justify-center transition-all ${
                      active
                        ? 'bg-[#1074B1] text-white shadow-xs font-bold scale-105'
                        : current
                        ? 'border-2 border-[#1074B1] text-[#1074B1] font-bold'
                        : 'hover:bg-black/5 dark:hover:bg-white/10'
                    }`}
                  >
                    {dayNum}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Shoot Milestone Presets */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider opacity-70 mb-2">
              Suggested Shoot Milestones
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleApplyPreset(preset)}
                  className="p-2.5 rounded-xl border text-left hover:border-[#1074B1] hover:bg-[#1074B1]/5 transition-all group"
                  style={{ borderColor: 'var(--theme-border)' }}
                >
                  <p className="text-xs font-bold group-hover:text-[#1074B1] truncate">{preset.name.split('—')[1]?.trim() || preset.name}</p>
                  <p className="text-[10px] opacity-65 mt-0.5">{preset.durationMinutes > 0 ? `${preset.durationMinutes} min event` : 'All-day deadline'}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Event Details Form */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold mb-1">Event Title</label>
              <input
                type="text"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border focus:border-[#1074B1] focus:outline-none transition-all"
                style={{
                  backgroundColor: 'var(--theme-surface)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text)',
                }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 opacity-70" />
                  <span>Start Time</span>
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border focus:border-[#1074B1] focus:outline-none transition-all"
                  style={{
                    backgroundColor: 'var(--theme-surface)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text)',
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Duration</label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border focus:border-[#1074B1] focus:outline-none transition-all"
                  style={{
                    backgroundColor: 'var(--theme-surface)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text)',
                  }}
                >
                  <option value={30}>30 Minutes</option>
                  <option value={45}>45 Minutes</option>
                  <option value={60}>1 Hour</option>
                  <option value={90}>1.5 Hours</option>
                  <option value={120}>2 Hours</option>
                  <option value={0}>All Day Event</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 opacity-70" />
                  <span>Location</span>
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Google Meet or Address"
                  className="w-full px-3 py-1.5 text-xs rounded-xl border focus:border-[#1074B1] focus:outline-none transition-all"
                  style={{
                    backgroundColor: 'var(--theme-surface)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text)',
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 opacity-70" />
                <span>Description & Drive References</span>
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border focus:border-[#1074B1] focus:outline-none transition-all resize-none"
                style={{
                  backgroundColor: 'var(--theme-surface)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className="px-5 py-3 border-t flex items-center justify-between shrink-0"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center gap-2">
            {isSuccessToast && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Dispatched to Google Calendar!</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddToGoogleCalendar}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#1074B1] to-[#52B197] hover:opacity-95 text-white text-xs font-bold shadow-xs transition-transform active:scale-95 flex items-center gap-1.5"
            >
              <CalendarIcon className="w-4 h-4" />
              <span>Add to Google Calendar</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
