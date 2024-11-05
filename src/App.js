import * as React from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

import { useZohoInit } from "./hook/useZohoInit";
import { zohoApi } from "./zohoApi";
import { Table } from "./components/organisms/Table";

const parentContainerStyle = {
  borderTop: "1px solid #BABABA",
  minHeight: "calc(100vh - 1px)",
  p: "1em",
  display: "grid",
  placeItems: "center",
};

function createData(id, name, calories, fat, carbs, protein) {
  return {
    id,
    name,
    calories,
    fat,
    carbs,
    protein,
  };
}

const rows = [
  createData(1, "Cupcake", 305, 3.7, 67, 4.3),
  createData(2, "Donut", 452, 25.0, 51, 4.9),
  createData(3, "Eclair", 262, 16.0, 24, 6.0),
  createData(4, "Frozen yoghurt", 159, 6.0, 24, 4.0),
  createData(5, "Gingerbread", 356, 16.0, 49, 3.9),
  createData(6, "Honeycomb", 408, 3.2, 87, 6.5),
  createData(7, "Ice cream sandwich", 237, 9.0, 37, 4.3),
  createData(8, "Jelly Bean", 375, 0.0, 94, 0.0),
  createData(9, "KitKat", 518, 26.0, 65, 7.0),
  createData(10, "Lollipop", 392, 0.2, 98, 0.0),
  createData(11, "Marshmallow", 318, 0, 81, 2.0),
  createData(12, "Nougat", 360, 19.0, 9, 37.0),
  createData(13, "Oreo", 437, 18.0, 63, 4.0),
];

function App() {
  const { module, recordId } = useZohoInit();
  const [initPageContent, setInitPageContent] = React.useState(
    <CircularProgress />
  );
  const [relatedListData, setRelatedListData] = React.useState();

  React.useEffect(() => {
    const fetchRLData = async () => {
      const { data } = await zohoApi.record.getRecordsFromRelatedList({
        module,
        recordId,
        RelatedListAPI: "History3",
      });

      data?.length < 1
        ? setInitPageContent("No data")
        : setInitPageContent(undefined);

      setRelatedListData(data);
    };

    if (module && recordId) {
      fetchRLData();
    }
  }, [module, recordId]);

  return (
    <Box sx={parentContainerStyle}>
      {initPageContent}
      {relatedListData?.length > 0 ? (
        <Table rows={rows} relatedListData={relatedListData} />
      ) : null}
    </Box>
  );
}

export default App;
