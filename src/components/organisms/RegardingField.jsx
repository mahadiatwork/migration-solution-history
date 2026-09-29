import React, { useState, useEffect, useRef } from "react";
import { FormControl, InputLabel, Select, MenuItem, TextField, Box } from "@mui/material";
import {
  CUSTOM_REGARDING_LABEL,
  CUSTOM_REGARDING_VALUE,
  getRegardingOptions,
} from "./helperFunc";

const RegardingField = ({ formData, handleInputChange, selectedRowData, picklistConfig }) => {
  const existingValue = formData?.regarding ?? selectedRowData?.regarding ?? "";
  const predefinedOptions = React.useMemo(
    () =>
      getRegardingOptions(formData?.type, existingValue, picklistConfig) || [],
    [existingValue, formData?.type, picklistConfig]
  );

  const [selectedValue, setSelectedValue] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [showManualInput, setShowManualInput] = useState(false); // New state to control visibility
  const previousType = useRef(formData?.type);

  useEffect(() => {
    const typeChanged = previousType.current !== formData?.type;
    previousType.current = formData?.type;

    // Keep the manual editor stable while its text is mirrored into formData.
    if (!typeChanged && showManualInput) return;

    if (existingValue) {
      if (predefinedOptions.includes(existingValue)) {
        setSelectedValue(existingValue);
        setManualInput("");
        setShowManualInput(false);
      } else {
        setSelectedValue(CUSTOM_REGARDING_VALUE);
        setManualInput(
          existingValue === CUSTOM_REGARDING_VALUE ? "" : existingValue
        );
        setShowManualInput(true);
      }
    } else {
      setSelectedValue("");
      setManualInput("");
      setShowManualInput(false);
    }
  }, [existingValue, formData?.type, predefinedOptions, showManualInput]);
  

  const handleSelectChange = (event) => {
    const value = event.target.value;
    setSelectedValue(value);

    if (value === CUSTOM_REGARDING_VALUE) {
      setShowManualInput(true);
      setManualInput("");
      handleInputChange("regarding", "");
    } else {
      setShowManualInput(false);
      setManualInput("");
      handleInputChange("regarding", value);
    }
  };
  

  const handleManualInputChange = (event) => {
    const value = event.target.value;
    setManualInput(value);
    handleInputChange("regarding", value);
  };

  return (
    <Box sx={{ width: "100%", mt: "3px" }}>
      <FormControl fullWidth size="small" variant="standard">
        <InputLabel id="regarding-label" sx={{ fontSize: "9pt" }}>
          Regarding
        </InputLabel>
        <Select
          labelId="regarding-label"
          id="regarding-select"
          value={selectedValue}
          onChange={handleSelectChange}
          sx={{ "& .MuiInputBase-root": { padding: "0 !important" }, fontSize: "9pt" }}
        >
          {(Array.isArray(predefinedOptions) ? predefinedOptions : []).map((option) => (
            <MenuItem key={option} value={option} sx={{ fontSize: "9pt" }}>
              {option}
            </MenuItem>
          ))}
          <MenuItem value={CUSTOM_REGARDING_VALUE} sx={{ fontSize: "9pt" }}>
            {CUSTOM_REGARDING_LABEL}
          </MenuItem>
        </Select>
      </FormControl>

      {showManualInput ?
        <TextField
          label="Enter your custom regarding"
          fullWidth
          variant="standard"
          size="small"
          value={manualInput}
          onChange={handleManualInputChange}
          sx={{
            mt: 2,
            "& .MuiInputBase-input": { fontSize: "9pt" },
            "& .MuiInputLabel-root": { fontSize: "9pt" },
            "& .MuiFormHelperText-root": { fontSize: "9pt" },
          }}
        /> : <></>
      }
    </Box>
  );
};

export default RegardingField;
