"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export default function usePatientPicker() {
  const [patients, setPatients] = useState([]);
  const [patientSearching, setPatientSearching] = useState(false);
  const [patientCache, setPatientCache] = useState({});
  const debounceRef = useRef(null);

  const fetchPatients = async (term = "") => {
    setPatientSearching(true);
    try {
      const params = new URLSearchParams({ limit: 30 });
      if (term) params.set("search", term);
      const res = await fetch(`/api/patients/get-patient?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPatients(data.patients || []);
      }
    } catch (error) {
      console.error("Error fetching patients:", error);
    } finally {
      setPatientSearching(false);
    }
  };

  useEffect(() => {
    fetchPatients("");
  }, []);

  const handleSearch = (term) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPatients(term), 350);
  };

  const addToCache = (patientObj) => {
    if (patientObj) setPatientCache((prev) => ({ ...prev, [patientObj._id]: patientObj }));
  };

  const options = useMemo(() => {
    const resultIds = new Set(patients.map((p) => p._id));
    const cached = Object.values(patientCache).filter((p) => !resultIds.has(p._id));
    return [...cached, ...patients];
  }, [patients, patientCache]);

  return {
    options,
    searching: patientSearching,
    onSearch: handleSearch,
    addToCache,
    cache: patientCache,
    refetch: fetchPatients,
  };
}
