import * as React from "react";
import dayjs from "dayjs";
import Box from "@mui/material/Box";
import { Table as MUITable } from "@mui/material";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Paper from "@mui/material/Paper";
import IconButton from "@mui/material/IconButton";
import AttachmentIcon from "@mui/icons-material/Attachment";
import { visuallyHidden } from "@mui/utils";
import { zohoApi } from "../../zohoApi";

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

  const handleRequestSort = (event, property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const handleClick = (event, id) => {
    setSelectedRecordId(id);
  };

  const visibleRows = React.useMemo(
    () => [...(rows || [])].sort(getComparator(order, orderBy)),
    [order, rows, orderBy]
  );

  return (
    <Paper sx={{ height: "25.5rem", overflowY: "auto" }}>
      <TableContainer>
        <MUITable aria-labelledby="tableTitle" size="small">
          <EnhancedTableHead
            order={order}
            orderBy={orderBy}
            onRequestSort={handleRequestSort}
            rowCount={rows?.length}
            // headCells={headCells}
          />
          <TableBody>
            {visibleRows.map((row, index) => {
              const labelId = `enhanced-table-checkbox-${index}`;

              return (
                <TableRow
                  hover
                  onClick={(event) =>
                    handleClick(
                      event,
                      row.id,
                      dayjs(row?.date_time).format("Z")
                    )
                  }
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
                    {row?.date_time
                      ? dayjs(row?.date_time).format("DD:MM:YYYY")
                      : null}
                  </TableCell>

                  <TableCell size="small" sx={{ width: "9%" }}>
                    {row?.date_time
                      ? dayjs(row?.date_time).format("h:mm A")
                      : null}
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
                      onClick={async () => {
                        const { data } = await zohoApi.file.getAttachments({
                          module: "History_X_Contacts",
                          recordId: row.id,
                        });
                        console.log(data?.[0]);
                        if (data?.length > 0) {
                          zohoApi.file.downloadAttachmentById({
                            module: "History_X_Contacts",
                            recordId: row.id,
                            attachmentId: data?.[0]?.id,
                          });
                        } else {
                          console.log("No data");
                        }
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
