"use client";

import useSWR from "swr";


const jsonFetcher = async (url) => {
  const res = await fetch(url, { credentials: "include" });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.error || body?.message || "";
    } catch {
    }
    const err = new Error(detail || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }

  return res.json();
};

export const CRM_SWR_DEFAULTS = {
  keepPreviousData: true,
  revalidateOnFocus: false,
  dedupingInterval: 15_000,
  errorRetryCount: 2,
};

export default function useCrmData(key, options = {}) {
  const { data, error, isLoading, isValidating, mutate } = useSWR(key, jsonFetcher, {
    ...CRM_SWR_DEFAULTS,
    ...options,
  });

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
  };
}
