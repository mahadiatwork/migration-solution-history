import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid2";

const parentContainerStyle = {
  borderTop: "1px solid #BABABA",
  minHeight: "calc(100vh - 1px)",
  p: "1em",
  // bgcolor: "yellow",
};

function App() {
  return (
    <Box sx={parentContainerStyle}>
      <Box sx={{ bgcolor: "yellow" }}>a</Box>
    </Box>
  );
}

export default App;
