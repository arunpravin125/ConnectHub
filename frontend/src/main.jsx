import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ChakraProvider, ColorModeScript, extendTheme } from '@chakra-ui/react'
import { mode } from "@chakra-ui/theme-tools"
import App from './App.jsx'
import './index.css'
import {BrowserRouter} from "react-router-dom"
import { RecoilRoot } from 'recoil'
import toast, { Toaster } from 'react-hot-toast';
import { SocketContextProvider } from './context/SocketContext.jsx'

const styles = {
  global: (props) => ({
    body: {
      color: mode("ink.900", "whiteAlpha.900")(props),
      bg: mode("sand.50", "ink.900")(props),
      backgroundImage: mode(
        "radial-gradient(1200px at -10% -10%, rgba(255, 107, 53, 0.18), transparent 60%), radial-gradient(900px at 110% -20%, rgba(20, 184, 166, 0.18), transparent 55%)",
        "radial-gradient(1000px at -20% -10%, rgba(255, 107, 53, 0.15), transparent 60%), radial-gradient(900px at 120% -10%, rgba(20, 184, 166, 0.12), transparent 55%)"
      )(props),
      backgroundAttachment: "fixed",
      minHeight: "100vh",
    },
    "*, *::before, *::after": {
      boxSizing: "border-box",
    },
    "*::selection": {
      background: mode("brand.200", "brand.600")(props),
      color: mode("ink.900", "white")(props),
    },
    a: {
      color: "inherit",
      textDecoration: "none",
    },
  }),
};

const config = {
  initialColorMode: "light",
  useSystemColorMode: true,
};

const colors = {
  gray: {
    light: "#616161",
    dark: "#1e1e1e",
  },
  brand: {
    50: "#FFF4ED",
    100: "#FFE6D5",
    200: "#FFC8A6",
    300: "#FFA878",
    400: "#FF8A4B",
    500: "#FF6B35",
    600: "#E5532A",
    700: "#B84021",
    800: "#8A2D18",
    900: "#5C1B0E",
  },
  ink: {
    50: "#F7F7F8",
    100: "#E8E9EB",
    200: "#C7C9CE",
    300: "#A3A7AF",
    400: "#7C828D",
    500: "#5E6572",
    600: "#434956",
    700: "#2F343F",
    800: "#1C2028",
    900: "#11141A",
  },
  sand: {
    50: "#FAF7F2",
    100: "#F3EEE5",
    200: "#E7DED0",
    300: "#D7C7B2",
    400: "#C4AE93",
    500: "#B09273",
    600: "#94765B",
    700: "#775C46",
    800: "#5B4533",
    900: "#3E2F22",
  },
};

const fonts = {
  heading: '"Space Grotesk", "Manrope", sans-serif',
  body: '"Manrope", "Space Grotesk", sans-serif',
};

const semanticTokens = {
  colors: {
    "bg.canvas": { default: "sand.50", _dark: "ink.900" },
    "bg.surface": { default: "white", _dark: "ink.800" },
    "bg.subtle": { default: "sand.100", _dark: "ink.700" },
    "border.subtle": { default: "sand.200", _dark: "ink.600" },
    "text.primary": { default: "ink.900", _dark: "whiteAlpha.900" },
    "text.secondary": { default: "ink.600", _dark: "whiteAlpha.700" },
    "accent.primary": { default: "brand.500", _dark: "brand.400" },
  },
};

const components = {
  Button: {
    baseStyle: {
      borderRadius: "full",
      fontWeight: "600",
    },
    defaultProps: {
      colorScheme: "brand",
    },
  },
  Input: {
    defaultProps: {
      variant: "filled",
      focusBorderColor: "brand.400",
    },
    variants: {
      filled: (props) => ({
        field: {
          borderRadius: "lg",
          bg: mode("sand.100", "ink.700")(props),
          border: "1px solid",
          borderColor: mode("sand.200", "ink.600")(props),
          _hover: {
            borderColor: mode("sand.300", "ink.500")(props),
          },
          _focusVisible: {
            borderColor: "brand.400",
            boxShadow: "0 0 0 1px var(--chakra-colors-brand-400)",
          },
        },
      }),
    },
  },
  Textarea: {
    defaultProps: {
      variant: "filled",
      focusBorderColor: "brand.400",
    },
    variants: {
      filled: (props) => ({
        borderRadius: "lg",
        bg: mode("sand.100", "ink.700")(props),
        border: "1px solid",
        borderColor: mode("sand.200", "ink.600")(props),
        _hover: {
          borderColor: mode("sand.300", "ink.500")(props),
        },
        _focusVisible: {
          borderColor: "brand.400",
          boxShadow: "0 0 0 1px var(--chakra-colors-brand-400)",
        },
      }),
    },
  },
  Modal: {
    baseStyle: (props) => ({
      dialog: {
        borderRadius: "xl",
        bg: mode("white", "ink.800")(props),
        border: "1px solid",
        borderColor: mode("sand.200", "ink.600")(props),
        boxShadow: "0 20px 50px -30px rgba(0, 0, 0, 0.4)",
      },
    }),
  },
};

export const theme = extendTheme({
  config,
  styles,
  colors,
  fonts,
  semanticTokens,
  components,
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
        <RecoilRoot>
    <BrowserRouter>
    <ChakraProvider theme={theme} >
  
    <ColorModeScript initialColorMode={theme.config.initialColorMode} />
    <SocketContextProvider>
    <App />
    </SocketContextProvider>
   
    </ChakraProvider>
    <Toaster />
    </BrowserRouter>
    
    </RecoilRoot>
  
  </StrictMode>,
)
