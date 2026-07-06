/* DevHome Workbench - Shadcn/ui 编译组件: changelog-dialog.jsx */
var changelogDialog = (() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
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
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

  // js/components/ui/changelog-dialog.jsx
  var { createElement: h, useEffect, useRef } = React;
  function ChangelogDialog({ open, onClose }) {
    const bodyRef = useRef(null);
    useEffect(() => {
      if (open && bodyRef.current) {
        var source = document.getElementById("changelogBody");
        if (source) {
          bodyRef.current.innerHTML = source.innerHTML;
        }
      }
    }, [open]);
    if (!open) return null;
    const eyebrowStyle = {
      display: "block",
      color: "var(--color-accent)",
      fontSize: "11px",
      fontWeight: 700,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      marginBottom: "2px"
    };
    const contentStyle = {
      width: "min(90vw, 640px)",
      maxHeight: "80vh",
      padding: "24px"
    };
    const bodyStyle = {
      maxHeight: "55vh",
      overflowY: "auto",
      padding: "0",
      scrollbarWidth: "thin",
      scrollbarColor: "var(--color-border) transparent"
    };
    return h(
      ShadcnDialog.Dialog,
      { open: true },
      h(ShadcnDialog.DialogOverlay, { onClick: onClose }),
      h(
        "div",
        {
          style: __spreadProps(__spreadValues({
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 2810
          }, contentStyle), {
            background: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border-active)",
            borderRadius: "24px",
            boxShadow: "var(--shadow-lg)",
            overflow: "hidden"
          })
        },
        h(
          ShadcnDialog.DialogHeader,
          null,
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" } },
            h(
              "div",
              null,
              h("span", { style: eyebrowStyle }, "Release Notes"),
              h(ShadcnDialog.DialogTitle, null, "\u66F4\u65B0\u8BF4\u660E")
            ),
            h(ShadcnButton, {
              variant: "outline",
              size: "sm",
              onClick: onClose,
              style: { flexShrink: 0 }
            }, "\u5173\u95ED")
          )
        ),
        h("div", { ref: bodyRef, style: bodyStyle })
      )
    );
  }
  window.ShadcnChangelogDialog = ChangelogDialog;
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vY29tcG9uZW50cy91aS9jaGFuZ2Vsb2ctZGlhbG9nLmpzeCJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyoqXG4gKiBEZXZIb21lIFdvcmtiZW5jaCAtIFNoYWRjbiBcdTY2RjRcdTY1QjBcdThCRjRcdTY2MEVcdTVGMzlcdTdBOTdcdTdFQzRcdTRFRjZcbiAqIFx1NjZGRlx1NEVFM1x1NTM5Rlx1NjcwOSAjY2hhbmdlbG9nT3ZlcmxheVx1RkYwQ1x1NEY3Rlx1NzUyOCBTaGFkY24gRGlhbG9nICsgQnV0dG9uIFx1N0VDNFx1NEVGNlx1MzAwMlxuICogXHU1MTg1XHU1QkI5XHU1M0Q2XHU4MUVBIGluZGV4Lmh0bWwgXHU0RTJEXHU3Njg0ICNjaGFuZ2Vsb2dCb2R5IFx1ODI4Mlx1NzBCOSBpbm5lckhUTUxcdTMwMDJcbiAqXG4gKiBcdTc1MzEgc2hhZGNuLWRpYWxvZ3MuanMgXHU3QkExXHU3NDA2XHU1NjY4XHU4QzAzXHU3NTI4XHVGRjBDXHU0RTBEXHU3NkY0XHU2M0E1XHU0RjdGXHU3NTI4XHUzMDAyXG4gKi9cbmNvbnN0IHsgY3JlYXRlRWxlbWVudDogaCwgdXNlRWZmZWN0LCB1c2VSZWYgfSA9IFJlYWN0O1xuXG5mdW5jdGlvbiBDaGFuZ2Vsb2dEaWFsb2coeyBvcGVuLCBvbkNsb3NlIH0pIHtcbiAgICBjb25zdCBib2R5UmVmID0gdXNlUmVmKG51bGwpO1xuXG4gICAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICAgICAgaWYgKG9wZW4gJiYgYm9keVJlZi5jdXJyZW50KSB7XG4gICAgICAgICAgICAvLyBcdTRFQ0VcdTk2OTBcdTg1Q0ZcdTc2ODRcdTk3NTlcdTYwMDFcdTZBMjFcdTY3N0ZcdTU5MERcdTUyMzZcdTUxODVcdTVCQjlcbiAgICAgICAgICAgIHZhciBzb3VyY2UgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2hhbmdlbG9nQm9keScpO1xuICAgICAgICAgICAgaWYgKHNvdXJjZSkge1xuICAgICAgICAgICAgICAgIGJvZHlSZWYuY3VycmVudC5pbm5lckhUTUwgPSBzb3VyY2UuaW5uZXJIVE1MO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSwgW29wZW5dKTtcblxuICAgIGlmICghb3BlbikgcmV0dXJuIG51bGw7XG5cbiAgICBjb25zdCBleWVicm93U3R5bGUgPSB7XG4gICAgICAgIGRpc3BsYXk6ICdibG9jaycsXG4gICAgICAgIGNvbG9yOiAndmFyKC0tY29sb3ItYWNjZW50KScsXG4gICAgICAgIGZvbnRTaXplOiAnMTFweCcsXG4gICAgICAgIGZvbnRXZWlnaHQ6IDcwMCxcbiAgICAgICAgbGV0dGVyU3BhY2luZzogJzAuMDRlbScsXG4gICAgICAgIHRleHRUcmFuc2Zvcm06ICd1cHBlcmNhc2UnLFxuICAgICAgICBtYXJnaW5Cb3R0b206ICcycHgnLFxuICAgIH07XG5cbiAgICBjb25zdCBjb250ZW50U3R5bGUgPSB7XG4gICAgICAgIHdpZHRoOiAnbWluKDkwdncsIDY0MHB4KScsXG4gICAgICAgIG1heEhlaWdodDogJzgwdmgnLFxuICAgICAgICBwYWRkaW5nOiAnMjRweCcsXG4gICAgfTtcblxuICAgIGNvbnN0IGJvZHlTdHlsZSA9IHtcbiAgICAgICAgbWF4SGVpZ2h0OiAnNTV2aCcsXG4gICAgICAgIG92ZXJmbG93WTogJ2F1dG8nLFxuICAgICAgICBwYWRkaW5nOiAnMCcsXG4gICAgICAgIHNjcm9sbGJhcldpZHRoOiAndGhpbicsXG4gICAgICAgIHNjcm9sbGJhckNvbG9yOiAndmFyKC0tY29sb3ItYm9yZGVyKSB0cmFuc3BhcmVudCcsXG4gICAgfTtcblxuICAgIHJldHVybiBoKFNoYWRjbkRpYWxvZy5EaWFsb2csIHsgb3BlbjogdHJ1ZSB9LFxuICAgICAgICBoKFNoYWRjbkRpYWxvZy5EaWFsb2dPdmVybGF5LCB7IG9uQ2xpY2s6IG9uQ2xvc2UgfSksXG4gICAgICAgIGgoJ2RpdicsIHtcbiAgICAgICAgICAgIHN0eWxlOiB7XG4gICAgICAgICAgICAgICAgcG9zaXRpb246ICdmaXhlZCcsXG4gICAgICAgICAgICAgICAgdG9wOiAnNTAlJyxcbiAgICAgICAgICAgICAgICBsZWZ0OiAnNTAlJyxcbiAgICAgICAgICAgICAgICB0cmFuc2Zvcm06ICd0cmFuc2xhdGUoLTUwJSwgLTUwJSknLFxuICAgICAgICAgICAgICAgIHpJbmRleDogMjgxMCxcbiAgICAgICAgICAgICAgICAuLi5jb250ZW50U3R5bGUsXG4gICAgICAgICAgICAgICAgYmFja2dyb3VuZDogJ3ZhcigtLWNvbG9yLWJnLWVsZXZhdGVkKScsXG4gICAgICAgICAgICAgICAgYm9yZGVyOiAnMXB4IHNvbGlkIHZhcigtLWNvbG9yLWJvcmRlci1hY3RpdmUpJyxcbiAgICAgICAgICAgICAgICBib3JkZXJSYWRpdXM6ICcyNHB4JyxcbiAgICAgICAgICAgICAgICBib3hTaGFkb3c6ICd2YXIoLS1zaGFkb3ctbGcpJyxcbiAgICAgICAgICAgICAgICBvdmVyZmxvdzogJ2hpZGRlbicsXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICAgICBoKFNoYWRjbkRpYWxvZy5EaWFsb2dIZWFkZXIsIG51bGwsXG4gICAgICAgICAgICAgICAgaCgnZGl2JywgeyBzdHlsZTogeyBkaXNwbGF5OiAnZmxleCcsIGp1c3RpZnlDb250ZW50OiAnc3BhY2UtYmV0d2VlbicsIGFsaWduSXRlbXM6ICdmbGV4LXN0YXJ0JywgZ2FwOiAnMTJweCcgfSB9LFxuICAgICAgICAgICAgICAgICAgICBoKCdkaXYnLCBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgaCgnc3BhbicsIHsgc3R5bGU6IGV5ZWJyb3dTdHlsZSB9LCAnUmVsZWFzZSBOb3RlcycpLFxuICAgICAgICAgICAgICAgICAgICAgICAgaChTaGFkY25EaWFsb2cuRGlhbG9nVGl0bGUsIG51bGwsICdcdTY2RjRcdTY1QjBcdThCRjRcdTY2MEUnKVxuICAgICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgICAgICBoKFNoYWRjbkJ1dHRvbiwge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyaWFudDogJ291dGxpbmUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZTogJ3NtJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s6IG9uQ2xvc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBzdHlsZTogeyBmbGV4U2hyaW5rOiAwIH1cbiAgICAgICAgICAgICAgICAgICAgfSwgJ1x1NTE3M1x1OTVFRCcpXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIGgoJ2RpdicsIHsgcmVmOiBib2R5UmVmLCBzdHlsZTogYm9keVN0eWxlIH0pXG4gICAgICAgIClcbiAgICApO1xufVxuXG53aW5kb3cuU2hhZGNuQ2hhbmdlbG9nRGlhbG9nID0gQ2hhbmdlbG9nRGlhbG9nO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFPQSxNQUFNLEVBQUUsZUFBZSxHQUFHLFdBQVcsT0FBTyxJQUFJO0FBRWhELFdBQVMsZ0JBQWdCLEVBQUUsTUFBTSxRQUFRLEdBQUc7QUFDeEMsVUFBTSxVQUFVLE9BQU8sSUFBSTtBQUUzQixjQUFVLE1BQU07QUFDWixVQUFJLFFBQVEsUUFBUSxTQUFTO0FBRXpCLFlBQUksU0FBUyxTQUFTLGVBQWUsZUFBZTtBQUNwRCxZQUFJLFFBQVE7QUFDUixrQkFBUSxRQUFRLFlBQVksT0FBTztBQUFBLFFBQ3ZDO0FBQUEsTUFDSjtBQUFBLElBQ0osR0FBRyxDQUFDLElBQUksQ0FBQztBQUVULFFBQUksQ0FBQyxLQUFNLFFBQU87QUFFbEIsVUFBTSxlQUFlO0FBQUEsTUFDakIsU0FBUztBQUFBLE1BQ1QsT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsWUFBWTtBQUFBLE1BQ1osZUFBZTtBQUFBLE1BQ2YsZUFBZTtBQUFBLE1BQ2YsY0FBYztBQUFBLElBQ2xCO0FBRUEsVUFBTSxlQUFlO0FBQUEsTUFDakIsT0FBTztBQUFBLE1BQ1AsV0FBVztBQUFBLE1BQ1gsU0FBUztBQUFBLElBQ2I7QUFFQSxVQUFNLFlBQVk7QUFBQSxNQUNkLFdBQVc7QUFBQSxNQUNYLFdBQVc7QUFBQSxNQUNYLFNBQVM7QUFBQSxNQUNULGdCQUFnQjtBQUFBLE1BQ2hCLGdCQUFnQjtBQUFBLElBQ3BCO0FBRUEsV0FBTztBQUFBLE1BQUUsYUFBYTtBQUFBLE1BQVEsRUFBRSxNQUFNLEtBQUs7QUFBQSxNQUN2QyxFQUFFLGFBQWEsZUFBZSxFQUFFLFNBQVMsUUFBUSxDQUFDO0FBQUEsTUFDbEQ7QUFBQSxRQUFFO0FBQUEsUUFBTztBQUFBLFVBQ0wsT0FBTztBQUFBLFlBQ0gsVUFBVTtBQUFBLFlBQ1YsS0FBSztBQUFBLFlBQ0wsTUFBTTtBQUFBLFlBQ04sV0FBVztBQUFBLFlBQ1gsUUFBUTtBQUFBLGFBQ0wsZUFOQTtBQUFBLFlBT0gsWUFBWTtBQUFBLFlBQ1osUUFBUTtBQUFBLFlBQ1IsY0FBYztBQUFBLFlBQ2QsV0FBVztBQUFBLFlBQ1gsVUFBVTtBQUFBLFVBQ2Q7QUFBQSxRQUNKO0FBQUEsUUFDSTtBQUFBLFVBQUUsYUFBYTtBQUFBLFVBQWM7QUFBQSxVQUN6QjtBQUFBLFlBQUU7QUFBQSxZQUFPLEVBQUUsT0FBTyxFQUFFLFNBQVMsUUFBUSxnQkFBZ0IsaUJBQWlCLFlBQVksY0FBYyxLQUFLLE9BQU8sRUFBRTtBQUFBLFlBQzFHO0FBQUEsY0FBRTtBQUFBLGNBQU87QUFBQSxjQUNMLEVBQUUsUUFBUSxFQUFFLE9BQU8sYUFBYSxHQUFHLGVBQWU7QUFBQSxjQUNsRCxFQUFFLGFBQWEsYUFBYSxNQUFNLDBCQUFNO0FBQUEsWUFDNUM7QUFBQSxZQUNBLEVBQUUsY0FBYztBQUFBLGNBQ1osU0FBUztBQUFBLGNBQ1QsTUFBTTtBQUFBLGNBQ04sU0FBUztBQUFBLGNBQ1QsT0FBTyxFQUFFLFlBQVksRUFBRTtBQUFBLFlBQzNCLEdBQUcsY0FBSTtBQUFBLFVBQ1g7QUFBQSxRQUNKO0FBQUEsUUFDQSxFQUFFLE9BQU8sRUFBRSxLQUFLLFNBQVMsT0FBTyxVQUFVLENBQUM7QUFBQSxNQUMvQztBQUFBLElBQ0o7QUFBQSxFQUNKO0FBRUEsU0FBTyx3QkFBd0I7IiwKICAibmFtZXMiOiBbXQp9Cg==
