"use client";

import { useState, useEffect, useRef } from "react";

export default function DebouncedDateInput({ value, onCommit, className, delay = 400, ...rest }) {
  const [local, setLocal] = useState(value || "");
  const timerRef = useRef(null);

  useEffect(() => { setLocal(value || ""); }, [value]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleChange = (next) => {
    setLocal(next);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onCommit(next), delay);
  };

  return (
    <input
      type="date"
      value={local}
      onChange={(e) => handleChange(e.target.value)}
      className={className}
      {...rest}
    />
  );
}
