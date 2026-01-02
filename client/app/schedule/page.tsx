"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { format } from "date-fns";
import Link from "next/link";

export default function SchedulePage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [role, setRole] = useState("");

  useEffect(() => {
    fetchSchedule();
    fetchMe();
  }, []);

  const fetchMe = async () => {
      try {
          const res = await api.get("/auth/me");
          setRole(res.data.role);
      } catch (err) {
          console.error(err);
      }
  };

  const fetchSchedule = async () => {
    try {
      const res = await api.get("/schedule/me");
      setSchedules(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-800">My Schedule</h1>
          {['HOD', 'HR', 'GM'].includes(role) && (
              <Link 
                  href="/schedule/manage"
                  className="bg-[#0F4D39] text-white px-4 py-2 rounded hover:bg-[#0a3628]"
              >
                  Manage Department Schedule
              </Link>
          )}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {schedules.map((schedule) => (
                <div key={schedule.id} className="border p-4 rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-lg text-[#0F4D39]">
                            {format(new Date(schedule.date), 'EEEE')}
                        </span>
                        <span className="text-sm text-gray-700">
                            {format(new Date(schedule.date), 'MMM dd')}
                        </span>
                    </div>
                    <div className="text-gray-900 font-medium">
                        {format(new Date(schedule.shiftStart), 'HH:mm')} - {format(new Date(schedule.shiftEnd), 'HH:mm')}
                    </div>
                    {schedule.description && (
                        <p className="text-sm text-gray-700 mt-2">{schedule.description}</p>
                    )}
                </div>
            ))}
            {schedules.length === 0 && (
                <p className="text-gray-700">No schedule assigned yet.</p>
            )}
        </div>
      </div>
    </div>
  );
}
