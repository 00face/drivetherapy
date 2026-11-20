/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Calendar Integration Engine
 * Constructs standardized Google Calendar event template URLs,
 * UTC ISO compact date strings (YYYYMMDDTHHmmssZ), and shoot milestone presets.
 */

export interface CalendarEventParams {
  title: string;
  startDate: Date;
  endDate?: Date;
  location?: string;
  description?: string;
  allDay?: boolean;
}

export interface ShootMilestonePreset {
  id: string;
  name: string;
  durationMinutes: number;
  descriptionTemplate: string;
}

export class GoogleCalendarEngine {
  /**
   * Formats a Date object into Google Calendar compact UTC format:
   * "YYYYMMDDTHHmmssZ" or "YYYYMMDD" for all-day events.
   */
  public formatGoogleCalendarDate(date: Date, allDay: boolean = false): string {
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

    const year = date.getUTCFullYear();
    const month = pad(date.getUTCMonth() + 1);
    const day = pad(date.getUTCDate());

    if (allDay) {
      return `${year}${month}${day}`;
    }

    const hours = pad(date.getUTCHours());
    const minutes = pad(date.getUTCMinutes());
    const seconds = pad(date.getUTCSeconds());

    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
  }

  /**
   * Constructs the official Google Calendar event creation URL:
   * https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=...&details=...&location=...
   */
  public generateGoogleCalendarUrl(params: CalendarEventParams): string {
    const {
      title,
      startDate,
      endDate,
      location = '',
      description = '',
      allDay = false,
    } = params;

    const startFormatted = this.formatGoogleCalendarDate(startDate, allDay);
    // If no end date provided, default to 1 hour after start (or next day for all-day)
    const effectiveEnd = endDate || new Date(startDate.getTime() + (allDay ? 86400000 : 3600000));
    const endFormatted = this.formatGoogleCalendarDate(effectiveEnd, allDay);

    const datesParam = `${startFormatted}/${endFormatted}`;

    const query = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: datesParam,
      details: description,
      location: location,
    });

    return `https://calendar.google.com/calendar/render?${query.toString()}`;
  }

  /**
   * Returns recommended production milestones based on active catalog folder and asset count.
   */
  public getShootMilestonePresets(projectName: string, heroCount: number = 0): ShootMilestonePreset[] {
    return [
      {
        id: 'review_call',
        name: `${projectName} — Client Gallery Review Call`,
        durationMinutes: 45,
        descriptionTemplate: `Google Meet review call with client for ${projectName}.\nReviewing ${heroCount} approved hero selections.\nAll assets synced via Drive Therapy.`,
      },
      {
        id: 'culling_deadline',
        name: `${projectName} — Final Culling Approval Deadline`,
        durationMinutes: 0,
        descriptionTemplate: `Client selections required for ${projectName} culling finalization.\nApprove picks in Drive Therapy proofing gallery.`,
      },
      {
        id: 'deliverables_handover',
        name: `${projectName} — Master High-Res Delivery`,
        durationMinutes: 30,
        descriptionTemplate: `Delivery of full-res sRGB/print master files for ${projectName}.\nOriginal uncompressed RAWs preserved in Google Drive archive.`,
      },
    ];
  }

  /**
   * Opens Google Calendar event in a new browser tab.
   */
  public openGoogleCalendarEvent(params: CalendarEventParams): void {
    if (typeof window === 'undefined') return;
    const url = this.generateGoogleCalendarUrl(params);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  /**
   * Opens the main Google Calendar app in a new tab.
   */
  public openMainGoogleCalendar(): void {
    if (typeof window === 'undefined') return;
    window.open('https://calendar.google.com/', '_blank', 'noopener,noreferrer');
  }
}

export const googleCalendarEngine = new GoogleCalendarEngine();
