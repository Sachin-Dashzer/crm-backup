
"use client";

import { useState } from "react";
import Sidebar from "@/components/ReceptionSidebar";
import Topbar from "@/components/Topbar";
import { Calendar, Plus } from "lucide-react";

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState([]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role="reception" />
      <main className="flex-1 p-4 lg:p-8">
        <Topbar role="reception" />
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="w-6 h-6" />
              Appointments
            </h2>
            <button className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2">
              <Plus className="w-5 h-5" />
              New Appointment
            </button>
          </div>
          <div className="text-center py-12 text-gray-500">
            No appointments scheduled
          </div>
        </div>
      </main>
    </div>
  );
}
