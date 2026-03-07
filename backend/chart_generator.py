import logging
import os
import time
import uuid

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
import plotly.graph_objects as go

logger = logging.getLogger(__name__)

_PLOTLY_LAYOUT = dict(
    font=dict(family="Inter, system-ui, sans-serif", size=13),
    plot_bgcolor="#0f1117",
    paper_bgcolor="#0f1117",
    font_color="#e2e8f0",
    margin=dict(l=60, r=30, t=60, b=60),
    legend=dict(bgcolor="rgba(0,0,0,0)", borderwidth=0),
    xaxis=dict(gridcolor="#1e2d3d", linecolor="#2d3748", zerolinecolor="#2d3748"),
    yaxis=dict(gridcolor="#1e2d3d", linecolor="#2d3748", zerolinecolor="#2d3748"),
    colorway=["#4f8cff", "#34d399", "#f59e0b", "#ef4444", "#a78bfa", "#06b6d4"],
)


class ChartGenerator:
    def __init__(self, data=None):
        logger.info("Initializing ChartGenerator")
        if data is not None and not (isinstance(data, pd.DataFrame) and data.empty):
            self.data = data
        else:
            default_csv = os.path.join(
                os.path.dirname(__file__), "data", "sample_data.csv"
            )
            self.data = pd.read_csv(default_csv) if os.path.exists(default_csv) else pd.DataFrame()

    # -----------------------------------------------------------------------
    # Public
    # -----------------------------------------------------------------------

    def generate_chart(self, plot_args: dict) -> dict:
        """Return {"chart_path": str, "chart_spec": dict}."""
        t0 = time.time()
        logger.info(f"Generating chart: {plot_args}")

        x_col      = plot_args["x"]
        y_cols     = plot_args["y"]
        chart_type = plot_args.get("chart_type", "line")
        color      = plot_args.get("color", None)

        self._validate_columns(x_col, y_cols)

        chart_path = self._save_matplotlib(x_col, y_cols, chart_type, color)
        chart_spec = self._build_plotly_spec(x_col, y_cols, chart_type, color)

        logger.info(f"Chart ready in {time.time() - t0:.2f}s")
        return {"chart_path": chart_path, "chart_spec": chart_spec}

    # -----------------------------------------------------------------------
    # Validation
    # -----------------------------------------------------------------------

    def _validate_columns(self, x_col: str, y_cols: list):
        missing = [c for c in [x_col] + y_cols if c not in self.data.columns]
        if missing:
            raise ValueError(
                f"Columns not found in data: {missing}. "
                f"Available: {list(self.data.columns)}"
            )

    # -----------------------------------------------------------------------
    # Matplotlib (static PNG)
    # -----------------------------------------------------------------------

    def _save_matplotlib(self, x_col, y_cols, chart_type, color) -> str:
        plt.clf()
        plt.close("all")
        fig, ax = plt.subplots(figsize=(10, 6))
        fig.patch.set_facecolor("#0f1117")
        ax.set_facecolor("#0f1117")

        palette = ["#4f8cff", "#34d399", "#f59e0b", "#ef4444", "#a78bfa"]
        x = self.data[x_col]

        for i, y_col in enumerate(y_cols):
            c = color or palette[i % len(palette)]
            y = self.data[y_col]
            if chart_type == "bar":
                ax.bar(x, y, label=y_col, color=c, alpha=0.85)
            elif chart_type == "scatter":
                ax.scatter(x, y, label=y_col, color=c, alpha=0.8)
            elif chart_type == "area":
                ax.fill_between(x, y, label=y_col, color=c, alpha=0.4)
                ax.plot(x, y, color=c)
            elif chart_type == "histogram":
                ax.hist(y, label=y_col, color=c, alpha=0.8, bins="auto", edgecolor="#1e2d3d")
            elif chart_type == "box":
                ax.boxplot(
                    [self.data[y_col].dropna().values for y_col in y_cols],
                    labels=y_cols,
                    patch_artist=True,
                    boxprops=dict(facecolor=c, color="#e2e8f0"),
                    medianprops=dict(color="#f59e0b", linewidth=2),
                )
                break
            elif chart_type == "pie":
                ax.pie(
                    y, labels=x, autopct="%1.1f%%",
                    colors=palette, startangle=90,
                    wedgeprops=dict(edgecolor="#0f1117"),
                )
                ax.set_aspect("equal")
                break
            else:
                ax.plot(x, y, label=y_col, color=c, marker="o", linewidth=2)

        for spine in ax.spines.values():
            spine.set_edgecolor("#2d3748")
        ax.tick_params(colors="#94a3b8")
        ax.xaxis.label.set_color("#94a3b8")
        ax.yaxis.label.set_color("#94a3b8")
        ax.set_xlabel(x_col, fontsize=11)
        ax.set_ylabel(" / ".join(y_cols), fontsize=11)
        ax.set_title(f"{chart_type.title()} \u2014 {', '.join(y_cols)} vs {x_col}",
                     color="#e2e8f0", fontsize=13, pad=12)
        ax.grid(True, alpha=0.15, color="#1e2d3d")
        if chart_type not in ("pie", "histogram"):
            ax.legend(facecolor="#161b27", edgecolor="#2d3748", labelcolor="#e2e8f0")
        if chart_type not in ("pie", "histogram", "box") and len(x) > 5:
            plt.xticks(rotation=45, ha="right")

        output_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "images")
        os.makedirs(output_dir, exist_ok=True)
        filename  = f"chart_{uuid.uuid4().hex[:12]}.png"
        full_path = os.path.join(output_dir, filename)
        plt.savefig(full_path, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
        plt.close(fig)
        logger.info(f"Saved PNG: {full_path} ({os.path.getsize(full_path)} bytes)")
        return os.path.join("static", "images", filename)

    # -----------------------------------------------------------------------
    # Plotly (interactive JSON spec for frontend)
    # -----------------------------------------------------------------------

    def _build_plotly_spec(self, x_col, y_cols, chart_type, color) -> dict:
        palette = ["#4f8cff", "#34d399", "#f59e0b", "#ef4444", "#a78bfa"]
        x = self.data[x_col].tolist()
        traces = []

        for i, y_col in enumerate(y_cols):
            c = color or palette[i % len(palette)]
            y = self.data[y_col].tolist()

            if chart_type == "bar":
                traces.append(go.Bar(x=x, y=y, name=y_col, marker_color=c, opacity=0.85).to_plotly_json())
            elif chart_type == "scatter":
                traces.append(go.Scatter(x=x, y=y, name=y_col, mode="markers",
                                          marker=dict(color=c, size=8, opacity=0.8)).to_plotly_json())
            elif chart_type == "area":
                traces.append(go.Scatter(x=x, y=y, name=y_col, mode="lines",
                                          fill="tozeroy", line=dict(color=c)).to_plotly_json())
            elif chart_type == "histogram":
                traces.append(go.Histogram(x=y, name=y_col, marker_color=c, opacity=0.8).to_plotly_json())
            elif chart_type == "box":
                traces.append(go.Box(y=y, name=y_col, marker_color=c,
                                      line_color="#e2e8f0", fillcolor=c).to_plotly_json())
            elif chart_type == "pie":
                traces.append(go.Pie(labels=x, values=y, name=y_col,
                                      marker=dict(colors=palette)).to_plotly_json())
                break
            else:  # line
                traces.append(go.Scatter(x=x, y=y, name=y_col, mode="lines+markers",
                                          line=dict(color=c, width=2),
                                          marker=dict(size=6)).to_plotly_json())

        layout = dict(
            **_PLOTLY_LAYOUT,
            title=dict(
                text=f"{chart_type.title()} \u2014 {', '.join(y_cols)} vs {x_col}",
                font=dict(size=15, color="#e2e8f0"),
            ),
            xaxis=dict(**_PLOTLY_LAYOUT["xaxis"], title=x_col),
            yaxis=dict(**_PLOTLY_LAYOUT["yaxis"], title=" / ".join(y_cols)),
        )

        return {"data": traces, "layout": layout}