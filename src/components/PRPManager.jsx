import { X, Plus } from "lucide-react";
import InputField from "./InputField";

const PRPManager = ({ prpSessions, onChange, onAdd, onRemove }) => {
  return (
    <div className="md:col-span-2">
      <h4 className="text-lg font-semibold text-gray-700 mb-4">PRP Sessions</h4>
      {prpSessions && prpSessions.length > 0 ? (
        <div className="space-y-4">
          {prpSessions.map((session, index) => (
            <div key={index} className="bg-gray-50 p-6 rounded-lg border relative">
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute top-4 right-4 text-red-500 hover:text-red-700 p-1"
                title="Remove PRP Session"
              >
                <X size={20} />
              </button>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-12">
                <InputField
                  label="PRP Number"
                  type="number"
                  value={session.prpNumber || ""}
                  onChange={(e) => onChange(index, "prpNumber", e.target.value)}
                  placeholder="Enter PRP session number"
                />
                <InputField
                  label="Date"
                  type="date"
                  value={session.date ? session.date.split("T")[0] : ""}
                  onChange={(e) => onChange(index, "date", e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-sm mb-4">No PRP sessions added yet</p>
      )}
      <button
        type="button"
        className="mt-4 px-6 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors duration-200 font-medium flex items-center gap-2"
        onClick={onAdd}
      >
        <Plus size={20} />
        Add PRP Session
      </button>
    </div>
  );
};

export default PRPManager;