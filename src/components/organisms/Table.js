import * as React from "react";
import Box from "@mui/material/Box";
import { Table as MUITable } from "@mui/material";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Paper from "@mui/material/Paper";
import IconButton from "@mui/material/IconButton";
import AttachmentIcon from "@mui/icons-material/Attachment";
import DownloadIcon from "@mui/icons-material/Download";
import { visuallyHidden } from "@mui/utils";
import { getDate } from "../../util/util";

const keyValMap = {
  History_Date_Time: "Date",
  //   History_Date_Time: "Time",
  History_Type: "Type",
  History_Result: "Result",
  duration_min: "Duration",
  Owner: "Record Manager",
  Regarding: "Regarding",
  History_Details: "Details",
};

function descendingComparator(a, b, orderBy) {
  if (b[orderBy] < a[orderBy]) {
    return -1;
  }
  if (b[orderBy] > a[orderBy]) {
    return 1;
  }
  return 0;
}

function getComparator(order, orderBy) {
  return order === "desc"
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

function EnhancedTableHead({ order, orderBy, onRequestSort }) {
  const createSortHandler = (property) => (event) => {
    onRequestSort(event, property);
  };

  const headCells = [
    {
      id: "date",
      numeric: false,
      disablePadding: true,
      label: "Date",
    },
    {
      id: "time",
      numeric: false,
      disablePadding: false,
      label: "Time",
    },
    {
      id: "type",
      numeric: false,
      disablePadding: false,
      label: "Type",
    },
    {
      id: "result",
      numeric: false,
      disablePadding: false,
      label: "Result",
    },
    {
      id: "duration",
      numeric: false,
      disablePadding: false,
      label: "Duration",
    },
    {
      id: "regarding_details",
      numeric: false,
      disablePadding: false,
      label: "Regarding & Details",
    },
    {
      id: "icon",
      numeric: false,
      disablePadding: false,
      label: <AttachmentIcon />,
      dontShowSort: true,
    },
    {
      id: "owner",
      numeric: false,
      disablePadding: false,
      label: "Record Manager",
    },
  ];

  return (
    <TableHead sx={{ bgcolor: "rgba(236, 240, 241, 1)" }}>
      <TableRow>
        {headCells.map((headCell, index) => {
          if (headCell?.dontShowSort) {
            return (
              <TableCell
                key={headCell.id}
                align={headCell.numeric ? "right" : "left"}
                sortDirection={orderBy === headCell.id ? order : false}
                size="small"
              >
                {headCell.label}
              </TableCell>
            );
          }
          return (
            <TableCell
              key={headCell.id}
              align={headCell.numeric ? "right" : "left"}
              sortDirection={orderBy === headCell.id ? order : false}
              size="small"
            >
              <TableSortLabel
                active={orderBy === headCell.id}
                direction={orderBy === headCell.id ? order : "asc"}
                onClick={createSortHandler(headCell.id)}
              >
                {headCell.label}
                {orderBy === headCell.id ? (
                  <Box component="span" sx={visuallyHidden}>
                    {order === "desc"
                      ? "sorted descending"
                      : "sorted ascending"}
                  </Box>
                ) : null}
              </TableSortLabel>
            </TableCell>
          );
        })}
      </TableRow>
    </TableHead>
  );
}

export function Table({
  rows,
  setSelectedRecordId,
  handleClickOpenEditDialog,
}) {
  const [order, setOrder] = React.useState("asc");
  const [orderBy, setOrderBy] = React.useState("calories");

  const tempRows = rows?.map((obj) => ({
    id: obj?.id,
    date: getDate(obj?.History_Date_Time)?.[0],
    time: getDate(obj?.History_Date_Time)?.[1],
    type: obj?.History_Type,
    result: obj?.History_Result,
    duration: obj?.duration_min,
    record_Manager: obj?.Owner,
    regarding: obj?.Regarding,
    details: obj?.History_Details,
    icon: <DownloadIcon />,
  }));

  const handleRequestSort = (event, property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const handleClick = (event, id) => {
    setSelectedRecordId(id);
  };

  const visibleRows = React.useMemo(
    () => [...(tempRows || [])].sort(getComparator(order, orderBy)),
    [order, tempRows, orderBy]
  );

  return (
    <Paper sx={{ height: "25.5rem", overflowY: "auto" }}>
      <TableContainer>
        <MUITable aria-labelledby="tableTitle" size="small">
          <EnhancedTableHead
            order={order}
            orderBy={orderBy}
            onRequestSort={handleRequestSort}
            rowCount={tempRows?.length}
            // headCells={headCells}
          />
          <TableBody>
            {visibleRows.map((row, index) => {
              const labelId = `enhanced-table-checkbox-${index}`;

              return (
                <TableRow
                  hover
                  onClick={(event) => handleClick(event, row.id)}
                  onDoubleClick={(event) => {
                    handleClick(event, row.id);
                    handleClickOpenEditDialog();
                  }}
                  tabIndex={-1}
                  key={row.id}
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell
                    component="th"
                    id={labelId}
                    scope="row"
                    size="small"
                    sx={{ width: "6%" }}
                  >
                    {row.date}
                  </TableCell>

                  <TableCell size="small" sx={{ width: "9%" }}>
                    {row.time}
                  </TableCell>
                  <TableCell size="small" sx={{ width: "9%" }}>
                    {row.type}
                  </TableCell>
                  <TableCell size="small" sx={{ width: "15%" }}>
                    {row.result}
                  </TableCell>
                  <TableCell size="small" sx={{ width: "5%" }}>
                    {row.duration}
                  </TableCell>
                  <TableCell size="small">
                    {!!row.regarding ? (
                      <span
                        style={{
                          display: "block",
                          marginBottom: "4px",
                          padding: "4px",
                          backgroundColor: "rgba(236, 240, 241, 1)",
                          borderRadius: "4px",
                        }}
                      >
                        {row.regarding}
                      </span>
                    ) : null}
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2, // number of lines to show
                        lineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {row.details}
                    </span>
                  </TableCell>
                  <TableCell size="small" sx={{ width: "3%" }}>
                    <IconButton
                      disableRipple
                      onClick={() => {
                        console.log("icon clicked");
                      }}
                    >
                      {row.icon}
                    </IconButton>
                  </TableCell>
                  <TableCell size="small" sx={{ width: "16%" }}>
                    {row.record_Manager?.name}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </MUITable>
      </TableContainer>
    </Paper>
  );
}
