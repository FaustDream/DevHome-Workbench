/* DevHome Workbench - button.jsx (development) */
var button = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __objRest = (source, exclude) => {
    var target = {};
    for (var prop in source)
      if (__hasOwnProp.call(source, prop) && exclude.indexOf(prop) < 0)
        target[prop] = source[prop];
    if (source != null && __getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(source)) {
        if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
          target[prop] = source[prop];
      }
    return target;
  };

  // js/components/ui/button.jsx
  var { createElement: h } = React;
  function Button(_a) {
    var _b = _a, { className = "", variant = "default", size = "default", children } = _b, props = __objRest(_b, ["className", "variant", "size", "children"]);
    const baseStyles = {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      whiteSpace: "nowrap",
      borderRadius: "var(--radius-md)",
      fontSize: "14px",
      fontWeight: 500,
      fontFamily: "var(--font-sans)",
      cursor: "pointer",
      border: "none",
      outline: "none",
      transition: "all 0.15s ease"
    };
    const sizeStyles = {
      default: { height: "40px", padding: "8px 16px" },
      sm: { height: "36px", padding: "4px 12px", fontSize: "12px", borderRadius: "8px" },
      lg: { height: "44px", padding: "8px 32px", fontSize: "16px" },
      icon: { height: "40px", width: "40px", padding: 0 }
    };
    const variantStyles = {
      default: {
        background: "var(--color-accent)",
        color: "var(--color-text-inverse)"
      },
      destructive: {
        background: "var(--color-danger)",
        color: "#fff"
      },
      outline: {
        border: "1px solid var(--color-border)",
        background: "transparent",
        color: "var(--color-text)"
      },
      secondary: {
        background: "var(--color-bg-secondary)",
        color: "var(--color-text-secondary)"
      },
      ghost: {
        background: "transparent",
        color: "var(--color-text-secondary)"
      },
      link: {
        background: "transparent",
        color: "var(--color-accent)",
        textDecoration: "underline"
      }
    };
    const style = __spreadValues(__spreadValues(__spreadValues({}, baseStyles), sizeStyles[size] || sizeStyles.default), variantStyles[variant] || variantStyles.default);
    return h("button", __spreadValues({ className, style }, props), children);
  }
  window.ShadcnButton = Button;
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vY29tcG9uZW50cy91aS9idXR0b24uanN4Il0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKipcbiAqIERldkhvbWUgV29ya2JlbmNoIC0gU2hhZGNuL3VpIEJ1dHRvbiBcdTdFQzRcdTRFRjZcbiAqIFx1NTdGQVx1NEU4RSBzaGFkY24vdWkgXHU5OENFXHU2ODNDXHVGRjBDXHU5MDAyXHU5MTREXHU5ODc5XHU3NkVFIFNlbWFudGljIFRva2VuIFx1NEY1M1x1N0NGQlx1MzAwMlxuICogXG4gKiBcdTRGN0ZcdTc1MjhcdTY1QjlcdTVGMEY6XG4gKiAgIDxzY3JpcHQgc3JjPVwianMvbGliL3JlYWN0LmpzXCI+PC9zY3JpcHQ+XG4gKiAgIDxzY3JpcHQgc3JjPVwianMvbGliL3JlYWN0LWRvbS5qc1wiPjwvc2NyaXB0PlxuICogICA8c2NyaXB0IHNyYz1cImpzL3VpLWNvbXBvbmVudHMvYnV0dG9uLmpzXCI+PC9zY3JpcHQ+XG4gKiAgIFx1NzEzNlx1NTQwRVx1NTcyOCBSZWFjdCBcdTRFMkRcdTRGN0ZcdTc1MjggPEJ1dHRvbiB2YXJpYW50PVwiZGVmYXVsdFwiPlx1NzBCOVx1NTFGQjwvQnV0dG9uPlxuICovXG5cbmNvbnN0IHsgY3JlYXRlRWxlbWVudDogaCB9ID0gUmVhY3Q7XG5cbi8qKlxuICogU2hhZGNuIEJ1dHRvbiBcdTdFQzRcdTRFRjZcbiAqIEBwYXJhbSB7J2RlZmF1bHQnfCdkZXN0cnVjdGl2ZSd8J291dGxpbmUnfCdzZWNvbmRhcnknfCdnaG9zdCd8J2xpbmsnfSB2YXJpYW50IC0gXHU2MzA5XHU5NEFFXHU5OENFXHU2ODNDXG4gKiBAcGFyYW0geydkZWZhdWx0J3wnc20nfCdsZyd8J2ljb24nfSBzaXplIC0gXHU2MzA5XHU5NEFFXHU1QzNBXHU1QkY4XG4gKi9cbmZ1bmN0aW9uIEJ1dHRvbih7IGNsYXNzTmFtZSA9ICcnLCB2YXJpYW50ID0gJ2RlZmF1bHQnLCBzaXplID0gJ2RlZmF1bHQnLCBjaGlsZHJlbiwgLi4ucHJvcHMgfSkge1xuICAgIGNvbnN0IGJhc2VTdHlsZXMgPSB7XG4gICAgICAgIGRpc3BsYXk6ICdpbmxpbmUtZmxleCcsXG4gICAgICAgIGFsaWduSXRlbXM6ICdjZW50ZXInLFxuICAgICAgICBqdXN0aWZ5Q29udGVudDogJ2NlbnRlcicsXG4gICAgICAgIGdhcDogJzhweCcsXG4gICAgICAgIHdoaXRlU3BhY2U6ICdub3dyYXAnLFxuICAgICAgICBib3JkZXJSYWRpdXM6ICd2YXIoLS1yYWRpdXMtbWQpJyxcbiAgICAgICAgZm9udFNpemU6ICcxNHB4JyxcbiAgICAgICAgZm9udFdlaWdodDogNTAwLFxuICAgICAgICBmb250RmFtaWx5OiAndmFyKC0tZm9udC1zYW5zKScsXG4gICAgICAgIGN1cnNvcjogJ3BvaW50ZXInLFxuICAgICAgICBib3JkZXI6ICdub25lJyxcbiAgICAgICAgb3V0bGluZTogJ25vbmUnLFxuICAgICAgICB0cmFuc2l0aW9uOiAnYWxsIDAuMTVzIGVhc2UnLFxuICAgIH07XG5cbiAgICBjb25zdCBzaXplU3R5bGVzID0ge1xuICAgICAgICBkZWZhdWx0OiB7IGhlaWdodDogJzQwcHgnLCBwYWRkaW5nOiAnOHB4IDE2cHgnIH0sXG4gICAgICAgIHNtOiB7IGhlaWdodDogJzM2cHgnLCBwYWRkaW5nOiAnNHB4IDEycHgnLCBmb250U2l6ZTogJzEycHgnLCBib3JkZXJSYWRpdXM6ICc4cHgnIH0sXG4gICAgICAgIGxnOiB7IGhlaWdodDogJzQ0cHgnLCBwYWRkaW5nOiAnOHB4IDMycHgnLCBmb250U2l6ZTogJzE2cHgnIH0sXG4gICAgICAgIGljb246IHsgaGVpZ2h0OiAnNDBweCcsIHdpZHRoOiAnNDBweCcsIHBhZGRpbmc6IDAgfSxcbiAgICB9O1xuXG4gICAgY29uc3QgdmFyaWFudFN0eWxlcyA9IHtcbiAgICAgICAgZGVmYXVsdDoge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogJ3ZhcigtLWNvbG9yLWFjY2VudCknLFxuICAgICAgICAgICAgY29sb3I6ICd2YXIoLS1jb2xvci10ZXh0LWludmVyc2UpJyxcbiAgICAgICAgfSxcbiAgICAgICAgZGVzdHJ1Y3RpdmU6IHtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICd2YXIoLS1jb2xvci1kYW5nZXIpJyxcbiAgICAgICAgICAgIGNvbG9yOiAnI2ZmZicsXG4gICAgICAgIH0sXG4gICAgICAgIG91dGxpbmU6IHtcbiAgICAgICAgICAgIGJvcmRlcjogJzFweCBzb2xpZCB2YXIoLS1jb2xvci1ib3JkZXIpJyxcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICd0cmFuc3BhcmVudCcsXG4gICAgICAgICAgICBjb2xvcjogJ3ZhcigtLWNvbG9yLXRleHQpJyxcbiAgICAgICAgfSxcbiAgICAgICAgc2Vjb25kYXJ5OiB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAndmFyKC0tY29sb3ItYmctc2Vjb25kYXJ5KScsXG4gICAgICAgICAgICBjb2xvcjogJ3ZhcigtLWNvbG9yLXRleHQtc2Vjb25kYXJ5KScsXG4gICAgICAgIH0sXG4gICAgICAgIGdob3N0OiB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAndHJhbnNwYXJlbnQnLFxuICAgICAgICAgICAgY29sb3I6ICd2YXIoLS1jb2xvci10ZXh0LXNlY29uZGFyeSknLFxuICAgICAgICB9LFxuICAgICAgICBsaW5rOiB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAndHJhbnNwYXJlbnQnLFxuICAgICAgICAgICAgY29sb3I6ICd2YXIoLS1jb2xvci1hY2NlbnQpJyxcbiAgICAgICAgICAgIHRleHREZWNvcmF0aW9uOiAndW5kZXJsaW5lJyxcbiAgICAgICAgfSxcbiAgICB9O1xuXG4gICAgY29uc3Qgc3R5bGUgPSB7XG4gICAgICAgIC4uLmJhc2VTdHlsZXMsXG4gICAgICAgIC4uLnNpemVTdHlsZXNbc2l6ZV0gfHwgc2l6ZVN0eWxlcy5kZWZhdWx0LFxuICAgICAgICAuLi52YXJpYW50U3R5bGVzW3ZhcmlhbnRdIHx8IHZhcmlhbnRTdHlsZXMuZGVmYXVsdCxcbiAgICB9O1xuXG4gICAgcmV0dXJuIGgoJ2J1dHRvbicsIHsgY2xhc3NOYW1lLCBzdHlsZSwgLi4ucHJvcHMgfSwgY2hpbGRyZW4pO1xufVxuXG4vLyBcdTY2QjRcdTk3MzJcdTUyMzBcdTUxNjhcdTVDNDBcbndpbmRvdy5TaGFkY25CdXR0b24gPSBCdXR0b247XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQVdBLE1BQU0sRUFBRSxlQUFlLEVBQUUsSUFBSTtBQU83QixXQUFTLE9BQU8sSUFBK0U7QUFBL0UsaUJBQUUsY0FBWSxJQUFJLFVBQVUsV0FBVyxPQUFPLFdBQVcsU0FsQnpFLElBa0JnQixJQUFzRSxrQkFBdEUsSUFBc0UsQ0FBcEUsYUFBZ0IsV0FBcUIsUUFBa0I7QUFDckUsVUFBTSxhQUFhO0FBQUEsTUFDZixTQUFTO0FBQUEsTUFDVCxZQUFZO0FBQUEsTUFDWixnQkFBZ0I7QUFBQSxNQUNoQixLQUFLO0FBQUEsTUFDTCxZQUFZO0FBQUEsTUFDWixjQUFjO0FBQUEsTUFDZCxVQUFVO0FBQUEsTUFDVixZQUFZO0FBQUEsTUFDWixZQUFZO0FBQUEsTUFDWixRQUFRO0FBQUEsTUFDUixRQUFRO0FBQUEsTUFDUixTQUFTO0FBQUEsTUFDVCxZQUFZO0FBQUEsSUFDaEI7QUFFQSxVQUFNLGFBQWE7QUFBQSxNQUNmLFNBQVMsRUFBRSxRQUFRLFFBQVEsU0FBUyxXQUFXO0FBQUEsTUFDL0MsSUFBSSxFQUFFLFFBQVEsUUFBUSxTQUFTLFlBQVksVUFBVSxRQUFRLGNBQWMsTUFBTTtBQUFBLE1BQ2pGLElBQUksRUFBRSxRQUFRLFFBQVEsU0FBUyxZQUFZLFVBQVUsT0FBTztBQUFBLE1BQzVELE1BQU0sRUFBRSxRQUFRLFFBQVEsT0FBTyxRQUFRLFNBQVMsRUFBRTtBQUFBLElBQ3REO0FBRUEsVUFBTSxnQkFBZ0I7QUFBQSxNQUNsQixTQUFTO0FBQUEsUUFDTCxZQUFZO0FBQUEsUUFDWixPQUFPO0FBQUEsTUFDWDtBQUFBLE1BQ0EsYUFBYTtBQUFBLFFBQ1QsWUFBWTtBQUFBLFFBQ1osT0FBTztBQUFBLE1BQ1g7QUFBQSxNQUNBLFNBQVM7QUFBQSxRQUNMLFFBQVE7QUFBQSxRQUNSLFlBQVk7QUFBQSxRQUNaLE9BQU87QUFBQSxNQUNYO0FBQUEsTUFDQSxXQUFXO0FBQUEsUUFDUCxZQUFZO0FBQUEsUUFDWixPQUFPO0FBQUEsTUFDWDtBQUFBLE1BQ0EsT0FBTztBQUFBLFFBQ0gsWUFBWTtBQUFBLFFBQ1osT0FBTztBQUFBLE1BQ1g7QUFBQSxNQUNBLE1BQU07QUFBQSxRQUNGLFlBQVk7QUFBQSxRQUNaLE9BQU87QUFBQSxRQUNQLGdCQUFnQjtBQUFBLE1BQ3BCO0FBQUEsSUFDSjtBQUVBLFVBQU0sUUFBUSxpREFDUCxhQUNBLFdBQVcsSUFBSSxLQUFLLFdBQVcsVUFDL0IsY0FBYyxPQUFPLEtBQUssY0FBYztBQUcvQyxXQUFPLEVBQUUsVUFBVSxpQkFBRSxXQUFXLFNBQVUsUUFBUyxRQUFRO0FBQUEsRUFDL0Q7QUFHQSxTQUFPLGVBQWU7IiwKICAibmFtZXMiOiBbXQp9Cg==
