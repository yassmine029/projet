# one-off: strip Three.js viewers from Modelisation3D.jsx
path = r"src/pages/Modelisation3D.jsx"
with open(path, encoding="utf-8") as f:
    lines = f.readlines()

a = lines[:9] + lines[309:]
idx = next(i for i, l in enumerate(a) if l.startswith("function Mini3DPreview("))
end = next(i for i, l in enumerate(a) if i > idx and l.startswith("function ReportPreviewModal("))
b = a[:idx] + a[end:]

# Replace Three imports (lines 1-7 of b) with VTK import
new_top = [
    'import React, { useEffect, useRef, useState } from \'react\';\n',
    'import { useNavigate, useSearchParams } from \'react-router-dom\';\n',
    'import { Box, ArrowLeft, X, FileText, Download, UserRound, Hash, CalendarDays, Brain, Activity, BarChart3 } from \'lucide-react\';\n',
    "import MeshViewerVTK from '../components/MeshViewerVTK.jsx';\n",
    "import api, { downloadSegmentationReportPdf } from '../api';\n",
    "\n",
]
# b[0:8] was: react, router, lucide, THREE, Orbit, OBJ, STL, api, blank - 9 lines in lines[:9]
# Actually original lines[:9] = indices 0-8 = 9 lines
rest_from = 9
b = new_top + b[rest_from:]

text = "".join(b)
text = text.replace("<Mini3DPreview\n", "<MeshViewerVTK\n                  variant=\"mini\"\n")
text = text.replace("</Mini3DPreview>", "</MeshViewerVTK>")
text = text.replace("<MeshViewer\n", "<MeshViewerVTK\n")
text = text.replace("</MeshViewer>", "</MeshViewerVTK>")

with open(path, "w", encoding="utf-8") as f:
    f.write(text)
print("OK", path)
