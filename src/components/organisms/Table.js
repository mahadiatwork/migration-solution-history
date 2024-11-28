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
import { useSnackbar } from "notistack";
import { zohoApi } from "../../zohoApi";
import DownloadIcon from '@mui/icons-material/Download';

const DownloadButton = ({ rowId, rowIcon }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [waitingForDownload, setWaitingForDownload] = React.useState(false);
  return (
    <IconButton
      sx={{ fontSize: "12pt" }}
      disableRipple
      onClick={async () => {
        setWaitingForDownload(true);
        const { data } = await zohoApi.file.getAttachments({
          module: "History1",
          recordId: rowId,
        });
        if (data?.length > 0) {
          await zohoApi.file.downloadAttachmentById({
            module: "History1",
            recordId: rowId,
            attachmentId: data?.[0]?.id,
            fileName: data?.[0]?.File_Name,
          });
          setWaitingForDownload(false);
        } else {
          enqueueSnackbar("No file.", { variant: "error" });
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
    { id: "name", numeric: false, label: "Name" },
    { id: "date_time", numeric: false, label: "Date & Time" },
    { id: "type", numeric: false, label: "Type" },
    { id: "result", numeric: false, label: "Result" },
    { id: "duration", numeric: false, label: "Duration" },
    { id: "regarding", numeric: false, label: "Regarding & Details", width: "400px" }, // Set width here
    { id: "icon", numeric: false, label: <AttachmentIcon />, dontShowSort: true },
    { id: "ownerName", numeric: false, label: "Record Manager" },
  ];

  return (
    <TableHead sx={{ bgcolor: "rgba(236, 240, 241, 1)" }}>
      <TableRow>
        {headCells.map((headCell) => (
          <TableCell
            key={headCell.id}
            align={headCell.numeric ? "right" : "left"}
            size="small"
            sx={{
              padding: "4px 8px",
              fontSize: "9pt",
              width: headCell.width || "auto", // Apply width here
            }}
          >
            {!headCell.dontShowSort ? (
              <TableSortLabel
                active={orderBy === headCell.id}
                direction={orderBy === headCell.id ? order : "asc"}
                onClick={createSortHandler(headCell.id)}
              >
                {headCell.label}
                {orderBy === headCell.id ? (
                  <Box component="span" sx={visuallyHidden}>
                    {order === "desc" ? "sorted descending" : "sorted ascending"}
                  </Box>
                ) : null}
              </TableSortLabel>
            ) : (
              headCell.label
            )}
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
  );
}

export function Table({ rows, setSelectedRecordId, handleClickOpenEditDialog,handleRightSideDataShow,searchKeyword }) {
  const [order, setOrder] = React.useState("asc");
  const [orderBy, setOrderBy] = React.useState("name");

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
        <MUITable
          aria-labelledby="tableTitle"
          size="small"
          sx={{
            tableLayout: "fixed",
            borderCollapse: "collapse",  // Add this line
          }}
        >
          <EnhancedTableHead
            order={order}
            orderBy={orderBy}
            handleRequestSort={handleRequestSort}
            rowCount={rows?.length}
          />
          <TableBody>
            {visibleRows.map((row, index) => {
              // Add a fallback to skip undefined rows
              if (!row || typeof row.name === "undefined") {
                console.warn("Skipping malformed row:", row);
                return null; // Skip this iteration
              }

              return (
                <TableRow
                  hover
                  key={row.id || index}
                  sx={{
                    cursor: "pointer",
                    borderBottom: "1px solid #ddd", // Add bottom border to TableRow
                    "& .MuiTableCell-root": {
                      padding: "4px 8px",
                      fontSize: "9pt",
                      borderBottom: "1px solid #ddd", // Ensure border for each TableCell
                    },
                  }}
                  onDoubleClick={() => handleClickOpenEditDialog(row)}
                  onClick={() => handleRightSideDataShow(row.regarding, row.details)}
                >
                  <TableCell
                    size="small"
                    sx={{
                      cursor: "pointer",
                      textDecoration: "underline",
                      color: "primary.main",
                    }}
                    onClick={() =>
                      row.historyDetails?.id &&
                      window.open(
                        `https://crm.zoho.com.au/crm/org7004396182/tab/CustomModule4/${row.historyDetails.id}`,
                        "_blank"
                      )
                    }
                  >
                    {row.historyDetails?.name || row.name || "Unknown Name"}
                  </TableCell>
                  <TableCell size="small">
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                      <span>{dayjs(row.date_time).format("DD/MM/YYYY")}</span>
                      <span>{dayjs(row.date_time).format("h:mm A")}</span>
                    </Box>
                  </TableCell>
                  <TableCell size="small">{row.type || "Unknown Type"}</TableCell>
                  <TableCell size="small">{row.result || "No Result"}</TableCell>
                  <TableCell size="small">{row.duration || "N/A"}</TableCell>
                  <TableCell
                    size="small"
                    sx={{
                      width: "400px", // Ensure this is applied correctly
                      whiteSpace: "normal", // Allow wrapping of text
                      wordWrap: "break-word", // Allow breaking long words
                      overflow: "hidden", // Hide overflow content
                    }}
                  >
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
                      {row.regarding || "No Regarding"}
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
                      {row.details || "No Details"}
                    </Box>
                  </TableCell>
                  <TableCell
                    size="small"
                  >
                    <DownloadButton rowId={row.id} rowIcon={<DownloadIcon />} />
                  </TableCell>
                  <TableCell size="small">{row.ownerName || "Unknown Owner"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </MUITable>
      </TableContainer>
    </Paper>
  );
}
