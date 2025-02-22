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
import CircularProgress from "@mui/material/CircularProgress";
import { visuallyHidden } from "@mui/utils";
import { zohoApi } from "../../zohoApi";

const DownloadButton = ({ rowId, rowIcon }) => {
  const [waitingForDownload, setWaitingForDownload] = React.useState(false);
  return (
    <IconButton
      disableRipple
      onClick={async () => {
        setWaitingForDownload(true);
        const { data } = await zohoApi.file.getAttachments({
          module: "History_X_Contacts",
          recordId: rowId,
        });
        // console.log(data);
        if (data?.length > 0) {
          await zohoApi.file.downloadAttachmentById({
            module: "History_X_Contacts",
            recordId: rowId,
            attachmentId: data?.[0]?.id,
            fileName: data?.[0]?.File_Name,
          });
          setWaitingForDownload(false);
        } else {
          console.log("No data");
          setWaitingForDownload(false);
        }
      }}
    >
      {waitingForDownload ? <CircularProgress size={16} /> : rowIcon}
    </IconButton>
  );
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

function EnhancedTableHead({ order, orderBy, handleRequestSort }) {
  const createSortHandler = (property) => (event) => {
    handleRequestSort(event, property);
  };

  const headCells = [
    {
      id: "date_time",
      numeric: false,
      disablePadding: true,
      label: "Date & Time",
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
      id: "regarding",
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
<<<<<<< Updated upstream
    {
      id: "ownerName",
      numeric: false,
      disablePadding: false,
      label: "Record Manager",
    },
=======
    { id: "owner", numeric: false, label: "Record Owner" },
>>>>>>> Stashed changes
  ];

  return (
    <TableHead sx={{ bgcolor: "rgba(236, 240, 241, 1)" }}>
      <TableRow>
        {headCells.map((headCell, index) => {
          if (headCell?.dontShowSort) {
            return (
              <TableCell
                key={headCell.id}
                // align={headCell.numeric ? "right" : "left"}
                // sortDirection={orderBy === headCell.id ? order : false}
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
            handleRequestSort={handleRequestSort}
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
                    sx={{ width: "15%" }}
                  >
                    {row?.date_time ? (
                      <span>
                        <span style={{ marginRight: ".5em" }}>
                          {dayjs(row?.date_time).format("DD:MM:YYYY")}
                        </span>
                        <span>{dayjs(row?.date_time).format("h:mm A")}</span>
                      </span>
                    ) : null}
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
<<<<<<< Updated upstream
                      {row.details}
                    </span>
                  </TableCell>
                  <TableCell size="small" sx={{ width: "3%" }}>
                    <DownloadButton rowId={row.id} rowIcon={row.icon} />
                  </TableCell>
                  <TableCell size="small" sx={{ width: "16%" }}>
                    {row.ownerName}
                  </TableCell>
                </TableRow>
              );
            })}
=======
                      <Box
                        sx={{
                          display: "-webkit-box",
                          WebkitLineClamp: 8,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "normal",
                          padding: "4px",
                        }}
                      >
                        {highlightText(row.regarding || "No Regarding", keyword)}
                      </Box>
                      <Box
                        sx={{
                          display: "-webkit-box",
                          WebkitLineClamp: 8,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "normal",
                          padding: "4px",
                        }}
                      >
                        {highlightText(row.details || "No Details", keyword)}
                      </Box>
                    </TableCell>
                    <TableCell size="small">
                      <DownloadButton
                        // rowId={row?.id}
                        isSelected={isSelected}
                        rowId={row.historyDetails?.id}
                        rowIcon={<DownloadIcon />}
                      />
                    </TableCell>
                    <TableCell size="small">
                      {row?.owner?.name || "Unknown Owner"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
>>>>>>> Stashed changes
          </TableBody>
        </MUITable>
      </TableContainer>
    </Paper>
  );
}
