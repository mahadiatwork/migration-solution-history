import * as React from "react";
import Box from "@mui/material/Box";
import { useZohoInit } from "./hook/useZohoInit";
import { zohoApi } from "./zohoApi";

const parentContainerStyle = {
  borderTop: "1px solid #BABABA",
  minHeight: "calc(100vh - 1px)",
  p: "1em",
};

function App() {
  const { module, recordId } = useZohoInit();

  React.useEffect(() => {
    const fetchRLData = async () => {
      const { data } = await zohoApi.record.getRecordsFromRelatedList({
        module,
        recordId,
        RelatedListAPI: "History3",
      });
      console.log({ data });
    };
    if (module && recordId) {
      fetchRLData();
    }
  }, [module, recordId]);

  return (
    <Box sx={parentContainerStyle}>
      <Box sx={{ bgcolor: "yellow" }}>a</Box>
    </Box>
  );
}

export default App;
