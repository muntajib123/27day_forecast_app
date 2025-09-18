// src/components/DateRangeFilter.js
import React from "react";
import { Box, Typography, TextField } from "@mui/material";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";

/*
DateRangeFilter props:
  - startDate: Date | null
  - endDate: Date | null
  - setStartDate: (Date|null) => void
  - setEndDate: (Date|null) => void

This component guarantees that callbacks receive JS Date objects or null.
*/

const DateRangeFilter = ({ startDate, endDate, setStartDate, setEndDate }) => {
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box
        display="flex"
        justifyContent="center"
        gap={2}
        flexWrap="wrap"
        mb={3}
      >
        <Box display="flex" flexDirection="column" alignItems="center">
          <Typography variant="body1" gutterBottom>
            Start Date
          </Typography>

          <DatePicker
            value={startDate ?? null}
            onChange={(newValue) => {
              // newValue can be a Date or null
              setStartDate(newValue ?? null);
            }}
            slotProps={{
              textField: {
                variant: "outlined",
                size: "small",
                placeholder: "MM/DD/YY",
                sx: {
                  width: 160,
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark" ? "#1e1e1e" : "#fff",
                },
              },
            }}
          />
        </Box>

        <Box display="flex" flexDirection="column" alignItems="center">
          <Typography variant="body1" gutterBottom>
            End Date
          </Typography>

          <DatePicker
            value={endDate ?? null}
            onChange={(newValue) => {
              setEndDate(newValue ?? null);
            }}
            slotProps={{
              textField: {
                variant: "outlined",
                size: "small",
                placeholder: "MM/DD/YY",
                sx: {
                  width: 160,
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark" ? "#1e1e1e" : "#fff",
                },
              },
            }}
          />
        </Box>
      </Box>
    </LocalizationProvider>
  );
};

export default DateRangeFilter;
