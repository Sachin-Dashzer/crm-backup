import React from 'react';

const InputField = ({
  label,
  type = "text",
  required = false,
  value,
  onChange,
  placeholder,
  options = [],
  className = "",
  disabled = false,
  error = "",
  id,
  name,
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  
  const baseInputClasses = `
    w-full px-4 py-3 rounded-lg border border-gray-300 
    focus:ring-2 focus:ring-blue-500 focus:border-transparent 
    transition-all duration-200 shadow-sm
    disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-70
  `;

  const renderInput = () => {
    switch (type) {
      case "select":
        return (
          <select
            id={inputId}
            name={name || inputId}
            className={`${baseInputClasses} ${error ? 'border-red-500' : ''}`}
            value={value}
            onChange={onChange}
            required={required}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
          >
            <option value="">Select {label}</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      
      case "textarea":
        return (
          <textarea
            id={inputId}
            name={name || inputId}
            className={`${baseInputClasses} ${error ? 'border-red-500' : ''} resize-none`}
            rows="4"
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
          />
        );
      
      case "checkbox":
        return (
          <div className="flex items-center space-x-3">
            <input
              id={inputId}
              name={name || inputId}
              type="checkbox"
              className={`h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded 
                ${error ? 'border-red-500' : ''}`}
              checked={Boolean(value)}
              onChange={onChange}
              disabled={disabled}
              aria-invalid={!!error}
              aria-describedby={error ? `${inputId}-error` : undefined}
            />
            <label htmlFor={inputId} className="text-sm text-gray-700 cursor-pointer">
              {placeholder || label}
            </label>
          </div>
        );
      
      default:
        return (
          <input
            id={inputId}
            name={name || inputId}
            type={type}
            className={`${baseInputClasses} ${error ? 'border-red-500' : ''}`}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
          />
        );
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && type !== "checkbox" && (
        <label 
          htmlFor={inputId} 
          className="block text-sm font-semibold text-gray-700"
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      {renderInput()}
      
      {error && (
        <p 
          id={`${inputId}-error`} 
          className="text-sm text-red-600 mt-1"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
};

export default InputField;