// src/components/DateRangeFilter.js

import React from "react";
import { Box, Typography, TextField } from "@mui/material";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";

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
            value={startDate}
            onChange={(newValue) => setStartDate(newValue)}
            slotProps={{
              textField: {
                variant: "outlined",
                size: "small",
                sx: {
                  width: 160,
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark" ? "#1e1e1e" : "#fff",
                  color: (theme) =>
                    theme.palette.mode === "dark" ? "#fff" : "#000",
                  input: {
                    color: (theme) =>
                      theme.palette.mode === "dark" ? "#fff" : "#000",
                  },
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
            value={endDate}
            onChange={(newValue) => setEndDate(newValue)}
            slotProps={{
              textField: {
                variant: "outlined",
                size: "small",
                sx: {
                  width: 160,
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark" ? "#1e1e1e" : "#fff",
                  color: (theme) =>
                    theme.palette.mode === "dark" ? "#fff" : "#000",
                  input: {
                    color: (theme) =>
                      theme.palette.mode === "dark" ? "#fff" : "#000",
                  },
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
