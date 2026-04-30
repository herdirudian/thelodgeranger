"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { format } from "date-fns";
import Link from "next/link";
import { formatWibDayName, formatWibMonthDay, formatWibTime } from "@/lib/wibHelpers";

function getScheduleStatus(description?: string) {
  const desc = (description || "").toLowerCase();

  if (!desc) return null;
  if (desc.includes("cuti") || desc.includes("unpaid leave")) {
    return {
      label: "Cuti",
      badgeClass: "bg-blue-50 text-blue-700 border-blue-100",
      textClass: "text-blue-800",
    };
  }
  if (desc.includes("sakit")) {
    return {
      label: "Sakit",
      badgeClass: "bg-yellow-50 text-yellow-700 border-yellow-100",
      textClass: "text-yellow-800",
    };
  }
  if (desc.includes("izin") || desc.includes("permission")) {
    return {
      label: "Izin",
      badgeClass: "bg-purple-50 text-purple-700 border-purple-100",
      textClass: "text-purple-800",
    };
  }
  if (desc.includes("dinas luar") || desc.includes("external duty")) {
    return {
      label: "Dinas Luar",
      badgeClass: "bg-orange-50 text-orange-700 border-orange-100",
      textClass: "text-orange-800",
    };
  }
  if (desc.includes("pending day off") || desc.includes("pdo")) {
    return {
      label: "Pending Day Off",
      badgeClass: "bg-amber-50 text-amber-700 border-amber-100",
      textClass: "text-amber-800",
    };
  }
  if (desc === "off" || desc.includes("off")) {
    return {
      label: "OFF",
      badgeClass: "bg-gray-100 text-gray-700 border-gray-200",
      textClass: "text-gray-800",
    };
  }

  return null;
}

function isMidnightRange(startValue: any, endValue: any) {
  const start = new Date(startValue);
  const end = new Date(endValue);

  return (
    start.getHours() === 0 &&
    start.getMinutes() === 0 &&
    end.getHours() === 0 &&
    end.getMinutes() === 0
  );
}

export default function SchedulePage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [role, setRole] = useState("");
  const now = new Date();
  const [viewMonth, setViewMonth] = useState<number>(now.getMonth());
  const [viewYear, setViewYear] = useState<number>(now.getFullYear());

  const fetchMe = async () => {
      try {
          const res = await api.get("/auth/me");
          setRole(res.data.role);
      } catch (err) {
          console.error(err);
      }
  };

  const fetchSchedule = async (start?: string, end?: string) => {
    try {
      const params: any = {};
      if (start) params.startDate = start;
      if (end) params.endDate = end;
      const res = await api.get("/schedule/me", { params });
      setSchedules(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const start = new Date(viewYear, viewMonth, 1);
    const end = new Date(viewYear, viewMonth + 1, 0);
    const s = format(start, 'yyyy-MM-dd');
    const e = format(end, 'yyyy-MM-dd');
    fetchSchedule(s, e);
    fetchMe();
  }, [viewMonth, viewYear]);

  const prevMonth = () => {
    setViewMonth(m => {
      const nm = m - 1;
      if (nm < 0) {
        setViewYear(y => y - 1);
        return 0;
      }
      return nm;
    });
  };
  const nextMonth = () => {
    setViewMonth(m => {
      const nm = m + 1;
      if (nm > 11) {
        setViewYear(y => y + 1);
        return 11;
      }
      return nm;
    });
  };
  const toCurrentMonth = () => {
    const d = new Date();
    setViewMonth(d.getMonth());
    setViewYear(d.getFullYear());
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-800">My Schedule</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={prevMonth} className="px-3 py-1 border rounded text-sm bg-white hover:bg-gray-50">Prev</button>
            <span className="text-sm font-semibold">{format(new Date(viewYear, viewMonth, 1), 'MMMM yyyy')}</span>
            <button onClick={nextMonth} className="px-3 py-1 border rounded text-sm bg-white hover:bg-gray-50">Next</button>
            <button onClick={toCurrentMonth} className="px-3 py-1 border rounded text-sm bg-white hover:bg-gray-50">Today</button>
          </div>
        </div>
        {['HOD', 'HR', 'GM', 'SUPERVISOR', 'PHOTOGRAPHER_HOD', 'MERCHANDISE_HOD', 'MERCHANDISE_SPV'].includes(role) && (
          <Link
            href="/schedule/manage"
            className="w-full md:w-auto text-center bg-[#0F4D39] text-white px-4 py-2 rounded hover:bg-[#0a3628]"
          >
            Manage Department Schedule
          </Link>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {schedules.map((schedule) => {
            const status = getScheduleStatus(schedule.description);
            const isAbsenceDay =
              status && isMidnightRange(schedule.shiftStart, schedule.shiftEnd);
            const shiftStart = new Date(schedule.shiftStart);
            const shiftEnd = new Date(schedule.shiftEnd);
            const hasShiftTime = !isMidnightRange(schedule.shiftStart, schedule.shiftEnd);
            const normalizedShiftName = schedule.shiftName ? String(schedule.shiftName).trim() : '';
            const normalizedDescription = schedule.description ? String(schedule.description).trim() : '';
            const shouldShowDescription =
              normalizedDescription &&
              (!normalizedShiftName || normalizedDescription !== `Shift ${normalizedShiftName}`);

            return (
              <div
                key={schedule.id}
                className={`border p-4 rounded-lg hover:shadow-md transition-shadow ${
                  isAbsenceDay ? "bg-amber-50 border-amber-200" : "bg-white"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-lg text-[#0F4D39]">
                    {formatWibDayName(schedule.date)}
                  </span>
                  <span className="text-sm text-gray-700">
                    {formatWibMonthDay(schedule.date)}
                  </span>
                </div>

                {isAbsenceDay ? (
                  <div className="mt-1 space-y-2">
                    {status && (
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${status.badgeClass}`}
                      >
                        {status.label}
                      </span>
                    )}
                    {schedule.description && (
                      <p
                        className={`text-sm mt-1 ${
                          status?.textClass || "text-gray-800"
                        }`}
                      >
                        {schedule.description}
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    {hasShiftTime && (
                      <div className="text-gray-900 font-medium">
                        {formatWibTime(shiftStart)} - {formatWibTime(shiftEnd)}
                      </div>
                    )}
                    {schedule.shiftName && (
                        <p className="text-sm text-gray-500 mt-1">
                            Shift {schedule.shiftName}
                        </p>
                    )}
                    {shouldShowDescription && (
                      <p className="text-sm text-gray-700 mt-2">
                        {schedule.description}
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
          {schedules.length === 0 && (
            <p className="text-gray-700">No schedule assigned yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
