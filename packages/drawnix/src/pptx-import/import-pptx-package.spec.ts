import { zipSync } from 'fflate';
import { importPptxPackage } from './import-pptx-package';

const encodeUtf8 = (value: string) =>
  new Uint8Array(Array.from(value).map((char) => char.charCodeAt(0)));

jest.mock('@plait/draw', () => ({
  ArrowLineMarkerType: {
    none: 'none',
    arrow: 'arrow',
  },
  ArrowLineShape: {
    straight: 'straight',
    elbow: 'elbow',
  },
  BasicShapes: {
    text: 'text',
    rectangle: 'rectangle',
    roundRectangle: 'roundRectangle',
    ellipse: 'ellipse',
    diamond: 'diamond',
    triangle: 'triangle',
    parallelogram: 'parallelogram',
    trapezoid: 'trapezoid',
    pentagon: 'pentagon',
    hexagon: 'hexagon',
    octagon: 'octagon',
    leftArrow: 'leftArrow',
    rightArrow: 'rightArrow',
    cross: 'cross',
    pentagonArrow: 'pentagonArrow',
    processArrow: 'processArrow',
    twoWayArrow: 'twoWayArrow',
    comment: 'comment',
    roundComment: 'roundComment',
    star: 'star',
    cloud: 'cloud',
  },
  createArrowLineElement: (
    shape: string,
    points: [number, number][],
    source: Record<string, unknown>,
    target: Record<string, unknown>,
    texts?: unknown,
    options?: Record<string, unknown>
  ) => ({
    id: '',
    type: 'arrow-line',
    shape,
    points,
    source,
    target,
    texts: texts ?? [],
    ...options,
  }),
  createGeometryElementWithText: (
    shape: string,
    points: [number, number][],
    text: string,
    options?: Record<string, unknown>,
    textProperties?: Record<string, unknown>
  ) => ({
    id: '',
    type: 'geometry',
    shape,
    points,
    text,
    textProperties,
    ...options,
  }),
}));

const buildPptxFile = (
  slideXml: string,
  slideRels = '',
  extraEntries: Record<string, Uint8Array> = {}
) => {
  const archive = zipSync({
    '[Content_Types].xml': encodeUtf8(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>`
    ),
    'ppt/presentation.xml': encodeUtf8(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:presentation
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:sldSz cx="9144000" cy="5143500"/>
        <p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst>
      </p:presentation>`
    ),
    'ppt/_rels/presentation.xml.rels': encodeUtf8(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="slide" Target="slides/slide1.xml"/>
      </Relationships>`
    ),
    'ppt/slides/slide1.xml': encodeUtf8(slideXml),
    'ppt/slides/_rels/slide1.xml.rels': encodeUtf8(slideRels),
    'ppt/media/image1.png': new Uint8Array([137, 80, 78, 71]),
    ...extraEntries,
  });
  return new File([archive], 'demo.pptx', {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
};

describe('importPptxPackage', () => {
  it('imports editable text and preserves font size, alignment, box, and rotation', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="2" name="Title"/></p:nvSpPr>
            <p:spPr>
              <a:xfrm rot="900000"><a:off x="95250" y="190500"/><a:ext cx="1905000" cy="476250"/></a:xfrm>
            </p:spPr>
            <p:txBody>
              <a:bodyPr lIns="95250" tIns="0" rIns="0" bIns="0"/>
              <a:p>
                <a:pPr algn="ctr"/>
                <a:r>
                  <a:rPr sz="2400" b="1"><a:solidFill><a:srgbClr val="112233"/></a:solidFill><a:latin typeface="Aptos"/></a:rPr>
                  <a:t>Hello PPTX</a:t>
                </a:r>
              </a:p>
            </p:txBody>
          </p:sp>
        </p:spTree></p:cSld>
      </p:sld>`
    );

    const result = await importPptxPackage(file);
    const text = result.elements.find(
      (element: any) => element.text === 'Hello PPTX'
    ) as any;

    expect(result.meta.slideCount).toBe(1);
    expect(text).toBeTruthy();
    expect(text.points).toEqual([
      [20, 20],
      [210, 70],
    ]);
    expect(text.textStyle.fontSize).toBe(32);
    expect(text.textStyle.align).toBe('center');
    expect(text.textStyle.fontFamily).toContain('Aptos');
    expect(text.textProperties.bold).toBe(true);
    expect(text.angle).toBe(15);
    expect(text.autoSize).toBe(false);
  });

  it('shrinks normal autofit text instead of expanding the source box', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="2" name="Autofit Text"/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="476250" cy="190500"/></a:xfrm><a:noFill/><a:ln/></p:spPr>
            <p:txBody>
              <a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0">
                <a:normAutofit/>
              </a:bodyPr>
              <a:p><a:r><a:rPr sz="2400"/><a:t>User natural language needs</a:t></a:r></a:p>
            </p:txBody>
          </p:sp>
        </p:spTree></p:cSld>
      </p:sld>`
    );

    const result = await importPptxPackage(file);
    const text = result.elements.find(
      (element: any) => element.text === 'User natural language needs'
    ) as any;

    expect(text.points).toEqual([
      [0, 0],
      [50, 20],
    ]);
    expect(text.textStyle.fontSize).toBeLessThan(32);
    expect(text.textProperties['font-size']).toBe(
      String(text.textStyle.fontSize)
    );
    expect(text.autoSize).toBe(false);
  });

  it('keeps normal autofit font size when the PowerPoint text already fits', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="2" name="Fitting Label"/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="2529399" cy="580408"/></a:xfrm><a:noFill/><a:ln/></p:spPr>
            <p:txBody>
              <a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0">
                <a:normAutofit/>
              </a:bodyPr>
              <a:p>
                <a:pPr><a:lnSpc><a:spcPts val="3746"/></a:lnSpc></a:pPr>
                <a:r><a:rPr sz="3360"/><a:t>User natural</a:t></a:r>
              </a:p>
            </p:txBody>
          </p:sp>
        </p:spTree></p:cSld>
      </p:sld>`
    );

    const result = await importPptxPackage(file);
    const text = result.elements.find(
      (element: any) => element.text === 'User natural'
    ) as any;

    expect(text.textStyle.fontSize).toBeCloseTo(44.8);
    expect(text.points).toEqual([
      [0, 0],
      [265.55370078740157, 60.93522309711286],
    ]);
  });

  it('imports basic shapes, connectors, and embedded images', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="3" name="Box"/></p:nvSpPr>
            <p:spPr>
              <a:xfrm><a:off x="95250" y="95250"/><a:ext cx="952500" cy="476250"/></a:xfrm>
              <a:prstGeom prst="roundRect"/>
              <a:solidFill><a:srgbClr val="EEF2FF"/></a:solidFill>
              <a:ln w="9525"><a:solidFill><a:srgbClr val="334155"/></a:solidFill></a:ln>
            </p:spPr>
          </p:sp>
          <p:cxnSp>
            <p:nvCxnSpPr><p:cNvPr id="4" name="Line"/></p:nvCxnSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="952500"/></a:xfrm></p:spPr>
          </p:cxnSp>
          <p:pic>
            <p:nvPicPr><p:cNvPr id="5" name="Image"/></p:nvPicPr>
            <p:blipFill><a:blip r:embed="rId2"/></p:blipFill>
            <p:spPr><a:xfrm><a:off x="1905000" y="0"/><a:ext cx="952500" cy="952500"/></a:xfrm></p:spPr>
          </p:pic>
        </p:spTree></p:cSld>
      </p:sld>`,
      `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId2" Type="image" Target="../media/image1.png"/>
      </Relationships>`
    );

    const result = await importPptxPackage(file);

    expect(result.summary.rectCount).toBe(2);
    expect(result.summary.arrowCount).toBe(1);
    expect(result.summary.componentCount).toBe(1);
    expect(
      result.elements.some((element: any) => element.shape === 'roundRectangle')
    ).toBe(true);
    expect(
      result.elements.some((element: any) => element.type === 'image')
    ).toBe(true);
  });

  it('preserves PowerPoint picture crop rectangles as cropped image assets', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:pic>
            <p:nvPicPr><p:cNvPr id="5" name="Cropped Image"/></p:nvPicPr>
            <p:blipFill>
              <a:blip r:embed="rId2"/>
              <a:srcRect l="25000" t="10000" r="25000" b="0"/>
            </p:blipFill>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="952500"/></a:xfrm></p:spPr>
          </p:pic>
        </p:spTree></p:cSld>
      </p:sld>`,
      `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId2" Type="image" Target="../media/image1.png"/>
      </Relationships>`
    );

    const result = await importPptxPackage(file);
    const image = result.elements.find(
      (element: any) => element.type === 'image'
    ) as any;
    const svg = decodeURIComponent(image.url.split(',')[1]);

    expect(image.url).toContain('data:image/svg+xml');
    expect(svg).toContain('<image');
    expect(svg).toContain('x="-50"');
    expect(svg).toContain('y="-11.111111"');
    expect(svg).toContain('width="200"');
    expect(svg).toContain('height="111.111111"');
  });

  it('preserves shape fill when only the outline is marked noFill', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="3" name="Filled Box"/></p:nvSpPr>
            <p:spPr>
              <a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="476250"/></a:xfrm>
              <a:prstGeom prst="rect"/>
              <a:solidFill><a:srgbClr val="DAE8FC"/></a:solidFill>
              <a:ln><a:noFill/></a:ln>
            </p:spPr>
          </p:sp>
        </p:spTree></p:cSld>
      </p:sld>`
    );

    const result = await importPptxPackage(file);
    const shape = result.elements.find(
      (element: any) =>
        element.shape === 'rectangle' && element.fill === '#DAE8FC'
    ) as any;

    expect(shape).toBeTruthy();
    expect(shape.strokeColor).toBe('transparent');
  });

  it('falls back gradient and pattern fills to editable solid colors', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="3" name="Gradient Box"/></p:nvSpPr>
            <p:spPr>
              <a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="476250"/></a:xfrm>
              <a:prstGeom prst="rect"/>
              <a:gradFill>
                <a:gsLst>
                  <a:gs pos="100000"><a:srgbClr val="FFFFFF"/></a:gs>
                  <a:gs pos="0"><a:srgbClr val="4472C4"/></a:gs>
                </a:gsLst>
              </a:gradFill>
              <a:ln><a:noFill/></a:ln>
            </p:spPr>
          </p:sp>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="4" name="Pattern Box"/></p:nvSpPr>
            <p:spPr>
              <a:xfrm><a:off x="952500" y="0"/><a:ext cx="952500" cy="476250"/></a:xfrm>
              <a:prstGeom prst="rect"/>
              <a:pattFill prst="pct50">
                <a:fgClr><a:srgbClr val="ED7D31"/></a:fgClr>
                <a:bgClr><a:srgbClr val="FFFFFF"/></a:bgClr>
              </a:pattFill>
              <a:ln><a:noFill/></a:ln>
            </p:spPr>
          </p:sp>
        </p:spTree></p:cSld>
      </p:sld>`
    );

    const result = await importPptxPackage(file);

    expect(
      result.elements.some(
        (element: any) =>
          element.id !== 'pptx-slide-1-frame' && element.fill === '#4472C4'
      )
    ).toBe(true);
    expect(
      result.elements.some(
        (element: any) =>
          element.id !== 'pptx-slide-1-frame' && element.fill === '#ED7D31'
      )
    ).toBe(true);
  });

  it('maps more PowerPoint preset shapes to editable Drawnix shapes', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          ${[
            'triangle',
            'parallelogram',
            'hexagon',
            'rightArrow',
            'plus',
            'leftRightArrow',
            'chevron',
            'wedgeRoundRectCallout',
            'star5',
            'cloud',
          ]
            .map(
              (preset, index) => `
              <p:sp>
                <p:nvSpPr><p:cNvPr id="${
                  index + 3
                }" name="${preset}"/></p:nvSpPr>
                <p:spPr>
                  <a:xfrm><a:off x="${
                    index * 952500
                  }" y="0"/><a:ext cx="952500" cy="476250"/></a:xfrm>
                  <a:prstGeom prst="${preset}"/>
                  <a:solidFill><a:srgbClr val="DAE8FC"/></a:solidFill>
                  <a:ln><a:noFill/></a:ln>
                </p:spPr>
              </p:sp>`
            )
            .join('')}
        </p:spTree></p:cSld>
      </p:sld>`
    );

    const result = await importPptxPackage(file);
    const shapes = result.elements.map((element: any) => element.shape);

    expect(shapes).toEqual(
      expect.arrayContaining([
        'triangle',
        'parallelogram',
        'hexagon',
        'rightArrow',
        'cross',
        'twoWayArrow',
        'processArrow',
        'roundComment',
        'star',
        'cloud',
      ])
    );
  });

  it('imports PowerPoint tables as editable cell shapes and text', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:graphicFrame>
            <p:nvGraphicFramePr><p:cNvPr id="3" name="Table"/></p:nvGraphicFramePr>
            <p:xfrm><a:off x="0" y="0"/><a:ext cx="1905000" cy="952500"/></p:xfrm>
            <a:graphic>
              <a:graphicData>
                <a:tbl>
                  <a:tblGrid>
                    <a:gridCol w="952500"/>
                    <a:gridCol w="952500"/>
                  </a:tblGrid>
                  <a:tr h="476250">
                    <a:tc>
                      <a:txBody>
                        <a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0"/>
                        <a:p><a:r><a:rPr sz="1800"><a:solidFill><a:srgbClr val="112233"/></a:solidFill></a:rPr><a:t>A1</a:t></a:r></a:p>
                      </a:txBody>
                      <a:tcPr><a:solidFill><a:srgbClr val="DAE8FC"/></a:solidFill></a:tcPr>
                    </a:tc>
                    <a:tc>
                      <a:txBody>
                        <a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0"/>
                        <a:p><a:r><a:rPr sz="1800"><a:solidFill><a:srgbClr val="44546A"/></a:solidFill></a:rPr><a:t>B1</a:t></a:r></a:p>
                      </a:txBody>
                      <a:tcPr><a:solidFill><a:srgbClr val="E7E6E6"/></a:solidFill></a:tcPr>
                    </a:tc>
                  </a:tr>
                </a:tbl>
              </a:graphicData>
            </a:graphic>
          </p:graphicFrame>
        </p:spTree></p:cSld>
      </p:sld>`
    );

    const result = await importPptxPackage(file);
    const a1 = result.elements.find(
      (element: any) => element.text === 'A1'
    ) as any;
    const cell = result.elements.find(
      (element: any) =>
        element.id.includes('-cell-0-0') && element.fill === '#DAE8FC'
    ) as any;

    expect(cell.points).toEqual([
      [0, 0],
      [100, 100],
    ]);
    expect(a1.textStyle.color).toBe('#112233');
    expect(result.meta.unsupportedCount).toBe(0);
  });

  it('imports cached PowerPoint bar charts as editable bars and labels', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:graphicFrame>
            <p:nvGraphicFramePr><p:cNvPr id="3" name="Bar Chart"/></p:nvGraphicFramePr>
            <p:xfrm><a:off x="0" y="0"/><a:ext cx="1905000" cy="952500"/></p:xfrm>
            <a:graphic>
              <a:graphicData>
                <c:chart r:id="rId2"/>
              </a:graphicData>
            </a:graphic>
          </p:graphicFrame>
        </p:spTree></p:cSld>
      </p:sld>`,
      `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId2" Type="chart" Target="../charts/chart1.xml"/>
      </Relationships>`,
      {
        'ppt/charts/chart1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <c:chartSpace
            xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <c:chart>
              <c:title><c:tx><c:rich><a:p><a:r><a:t>Quarterly Results</a:t></a:r></a:p></c:rich></c:tx></c:title>
              <c:plotArea>
                <c:barChart>
                  <c:ser>
                    <c:spPr><a:solidFill><a:srgbClr val="70AD47"/></a:solidFill></c:spPr>
                    <c:cat><c:strRef><c:strCache>
                      <c:pt idx="0"><c:v>Q1</c:v></c:pt>
                      <c:pt idx="1"><c:v>Q2</c:v></c:pt>
                    </c:strCache></c:strRef></c:cat>
                    <c:val><c:numRef><c:numCache>
                      <c:pt idx="0"><c:v>10</c:v></c:pt>
                      <c:pt idx="1"><c:v>20</c:v></c:pt>
                    </c:numCache></c:numRef></c:val>
                  </c:ser>
                </c:barChart>
              </c:plotArea>
            </c:chart>
          </c:chartSpace>`
        ),
      }
    );

    const result = await importPptxPackage(file);
    const bars = result.elements.filter(
      (element: any) =>
        element.id.includes('-bar-') && element.fill === '#70AD47'
    );

    expect(bars).toHaveLength(2);
    expect(
      result.elements.some(
        (element: any) => element.text === 'Quarterly Results'
      )
    ).toBe(true);
    expect(result.elements.some((element: any) => element.text === 'Q1')).toBe(
      true
    );
    expect(result.elements.some((element: any) => element.text === '20')).toBe(
      true
    );
    expect(result.meta.unsupportedCount).toBe(0);
  });

  it('preserves PowerPoint chart data point fill overrides', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:graphicFrame>
            <p:nvGraphicFramePr><p:cNvPr id="6" name="Point Color Chart"/></p:nvGraphicFramePr>
            <p:xfrm><a:off x="0" y="0"/><a:ext cx="1905000" cy="952500"/></p:xfrm>
            <a:graphic><a:graphicData><c:chart r:id="rId2"/></a:graphicData></a:graphic>
          </p:graphicFrame>
        </p:spTree></p:cSld>
      </p:sld>`,
      `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId2" Type="chart" Target="../charts/chart1.xml"/>
      </Relationships>`,
      {
        'ppt/_rels/presentation.xml.rels': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="slide" Target="slides/slide1.xml"/>
            <Relationship Id="rId2" Type="theme" Target="theme/theme1.xml"/>
          </Relationships>`
        ),
        'ppt/theme/theme1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Demo">
            <a:themeElements>
              <a:clrScheme name="Demo">
                <a:dk1><a:srgbClr val="000000"/></a:dk1>
                <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
                <a:accent1><a:srgbClr val="4472C4"/></a:accent1>
                <a:accent2><a:srgbClr val="ED7D31"/></a:accent2>
              </a:clrScheme>
            </a:themeElements>
          </a:theme>`
        ),
        'ppt/charts/chart1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <c:chartSpace
            xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <c:chart>
              <c:plotArea>
                <c:barChart>
                  <c:ser>
                    <c:spPr><a:solidFill><a:srgbClr val="70AD47"/></a:solidFill></c:spPr>
                    <c:dPt>
                      <c:idx val="1"/>
                      <c:spPr><a:solidFill><a:schemeClr val="accent2"/></a:solidFill></c:spPr>
                    </c:dPt>
                    <c:cat><c:strRef><c:strCache>
                      <c:pt idx="0"><c:v>A</c:v></c:pt>
                      <c:pt idx="1"><c:v>B</c:v></c:pt>
                    </c:strCache></c:strRef></c:cat>
                    <c:val><c:numRef><c:numCache>
                      <c:pt idx="0"><c:v>4</c:v></c:pt>
                      <c:pt idx="1"><c:v>8</c:v></c:pt>
                    </c:numCache></c:numRef></c:val>
                  </c:ser>
                </c:barChart>
              </c:plotArea>
            </c:chart>
          </c:chartSpace>`
        ),
      }
    );

    const result = await importPptxPackage(file);
    const firstBar = result.elements.find((element: any) =>
      element.id.includes('-bar-0')
    ) as any;
    const secondBar = result.elements.find((element: any) =>
      element.id.includes('-bar-1')
    ) as any;

    expect(firstBar.fill).toBe('#70AD47');
    expect(secondBar.fill).toBe('#ED7D31');
    expect(result.meta.unsupportedCount).toBe(0);
  });

  it('imports multi-series PowerPoint bar charts with separate editable colors', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:graphicFrame>
            <p:nvGraphicFramePr><p:cNvPr id="7" name="Multi Series Bar Chart"/></p:nvGraphicFramePr>
            <p:xfrm><a:off x="0" y="0"/><a:ext cx="2857500" cy="1428750"/></p:xfrm>
            <a:graphic><a:graphicData><c:chart r:id="rId2"/></a:graphicData></a:graphic>
          </p:graphicFrame>
        </p:spTree></p:cSld>
      </p:sld>`,
      `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId2" Type="chart" Target="../charts/chart1.xml"/>
      </Relationships>`,
      {
        'ppt/_rels/presentation.xml.rels': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="slide" Target="slides/slide1.xml"/>
            <Relationship Id="rId2" Type="theme" Target="theme/theme1.xml"/>
          </Relationships>`
        ),
        'ppt/theme/theme1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Demo">
            <a:themeElements>
              <a:clrScheme name="Demo">
                <a:dk1><a:srgbClr val="000000"/></a:dk1>
                <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
                <a:accent1><a:srgbClr val="4472C4"/></a:accent1>
                <a:accent2><a:srgbClr val="ED7D31"/></a:accent2>
              </a:clrScheme>
            </a:themeElements>
          </a:theme>`
        ),
        'ppt/charts/chart1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <c:chartSpace
            xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <c:chart>
              <c:plotArea>
                <c:barChart>
                  <c:ser>
                    <c:spPr><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></c:spPr>
                    <c:cat><c:strRef><c:strCache>
                      <c:pt idx="0"><c:v>Q1</c:v></c:pt>
                      <c:pt idx="1"><c:v>Q2</c:v></c:pt>
                    </c:strCache></c:strRef></c:cat>
                    <c:val><c:numRef><c:numCache>
                      <c:pt idx="0"><c:v>5</c:v></c:pt>
                      <c:pt idx="1"><c:v>7</c:v></c:pt>
                    </c:numCache></c:numRef></c:val>
                  </c:ser>
                  <c:ser>
                    <c:spPr><a:solidFill><a:schemeClr val="accent2"/></a:solidFill></c:spPr>
                    <c:cat><c:strRef><c:strCache>
                      <c:pt idx="0"><c:v>Q1</c:v></c:pt>
                      <c:pt idx="1"><c:v>Q2</c:v></c:pt>
                    </c:strCache></c:strRef></c:cat>
                    <c:val><c:numRef><c:numCache>
                      <c:pt idx="0"><c:v>6</c:v></c:pt>
                      <c:pt idx="1"><c:v>9</c:v></c:pt>
                    </c:numCache></c:numRef></c:val>
                  </c:ser>
                </c:barChart>
              </c:plotArea>
            </c:chart>
          </c:chartSpace>`
        ),
      }
    );

    const result = await importPptxPackage(file);
    const accent1Bars = result.elements.filter(
      (element: any) =>
        element.id.includes('-bar-0-') && element.fill === '#4472C4'
    );
    const accent2Bars = result.elements.filter(
      (element: any) =>
        element.id.includes('-bar-1-') && element.fill === '#ED7D31'
    );

    expect(accent1Bars).toHaveLength(2);
    expect(accent2Bars).toHaveLength(2);
    expect(result.elements.some((element: any) => element.text === 'Q2')).toBe(
      true
    );
    expect(result.elements.some((element: any) => element.text === '9')).toBe(
      true
    );
    expect(result.meta.unsupportedCount).toBe(0);
  });

  it('imports cached PowerPoint pie charts as editable colored segments and labels', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:graphicFrame>
            <p:nvGraphicFramePr><p:cNvPr id="10" name="Pie Chart"/></p:nvGraphicFramePr>
            <p:xfrm><a:off x="0" y="0"/><a:ext cx="2857500" cy="1428750"/></p:xfrm>
            <a:graphic><a:graphicData><c:chart r:id="rId2"/></a:graphicData></a:graphic>
          </p:graphicFrame>
        </p:spTree></p:cSld>
      </p:sld>`,
      `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId2" Type="chart" Target="../charts/chart1.xml"/>
      </Relationships>`,
      {
        'ppt/_rels/presentation.xml.rels': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="slide" Target="slides/slide1.xml"/>
            <Relationship Id="rId2" Type="theme" Target="theme/theme1.xml"/>
          </Relationships>`
        ),
        'ppt/theme/theme1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Demo">
            <a:themeElements>
              <a:clrScheme name="Demo">
                <a:dk1><a:srgbClr val="000000"/></a:dk1>
                <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
                <a:accent1><a:srgbClr val="4472C4"/></a:accent1>
                <a:accent2><a:srgbClr val="ED7D31"/></a:accent2>
                <a:accent3><a:srgbClr val="A5A5A5"/></a:accent3>
              </a:clrScheme>
            </a:themeElements>
          </a:theme>`
        ),
        'ppt/charts/chart1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <c:chartSpace
            xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <c:chart>
              <c:title><c:tx><c:rich><a:p><a:r><a:t>Share</a:t></a:r></a:p></c:rich></c:tx></c:title>
              <c:plotArea>
                <c:pieChart>
                  <c:ser>
                    <c:dPt>
                      <c:idx val="0"/>
                      <c:spPr><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></c:spPr>
                    </c:dPt>
                    <c:dPt>
                      <c:idx val="1"/>
                      <c:spPr><a:solidFill><a:schemeClr val="accent2"/></a:solidFill></c:spPr>
                    </c:dPt>
                    <c:dPt>
                      <c:idx val="2"/>
                      <c:spPr><a:solidFill><a:schemeClr val="accent3"/></a:solidFill></c:spPr>
                    </c:dPt>
                    <c:cat><c:strRef><c:strCache>
                      <c:pt idx="0"><c:v>Research</c:v></c:pt>
                      <c:pt idx="1"><c:v>Drafting</c:v></c:pt>
                      <c:pt idx="2"><c:v>Review</c:v></c:pt>
                    </c:strCache></c:strRef></c:cat>
                    <c:val><c:numRef><c:numCache>
                      <c:pt idx="0"><c:v>45</c:v></c:pt>
                      <c:pt idx="1"><c:v>35</c:v></c:pt>
                      <c:pt idx="2"><c:v>20</c:v></c:pt>
                    </c:numCache></c:numRef></c:val>
                  </c:ser>
                </c:pieChart>
              </c:plotArea>
            </c:chart>
          </c:chartSpace>`
        ),
      }
    );

    const result = await importPptxPackage(file);
    const segments = result.elements.filter(
      (element: any) =>
        element.id.includes('-pie-segment-') && element.shape === 'rectangle'
    );
    const swatches = result.elements.filter(
      (element: any) =>
        element.id.includes('-pie-swatch-') && element.shape === 'rectangle'
    );

    expect(segments.map((element: any) => element.fill)).toEqual([
      '#4472C4',
      '#ED7D31',
      '#A5A5A5',
    ]);
    expect(swatches).toHaveLength(3);
    expect(
      result.elements.some((element: any) => element.text === 'Share')
    ).toBe(true);
    expect(
      result.elements.some((element: any) => element.text === 'Drafting: 35')
    ).toBe(true);
    expect(result.meta.unsupportedCount).toBe(0);
  });

  it('imports cached PowerPoint line charts as editable line segments and markers', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:graphicFrame>
            <p:nvGraphicFramePr><p:cNvPr id="4" name="Line Chart"/></p:nvGraphicFramePr>
            <p:xfrm><a:off x="0" y="0"/><a:ext cx="2857500" cy="1428750"/></p:xfrm>
            <a:graphic>
              <a:graphicData>
                <c:chart r:id="rId2"/>
              </a:graphicData>
            </a:graphic>
          </p:graphicFrame>
        </p:spTree></p:cSld>
      </p:sld>`,
      `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId2" Type="chart" Target="../charts/chart1.xml"/>
      </Relationships>`,
      {
        'ppt/_rels/presentation.xml.rels': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="slide" Target="slides/slide1.xml"/>
            <Relationship Id="rId2" Type="theme" Target="theme/theme1.xml"/>
          </Relationships>`
        ),
        'ppt/theme/theme1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Demo">
            <a:themeElements>
              <a:clrScheme name="Demo">
                <a:dk1><a:srgbClr val="000000"/></a:dk1>
                <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
                <a:accent1><a:srgbClr val="4472C4"/></a:accent1>
                <a:accent2><a:srgbClr val="C00000"/></a:accent2>
              </a:clrScheme>
            </a:themeElements>
          </a:theme>`
        ),
        'ppt/charts/chart1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <c:chartSpace
            xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <c:chart>
              <c:title><c:tx><c:rich><a:p><a:r><a:t>Trend</a:t></a:r></a:p></c:rich></c:tx></c:title>
              <c:plotArea>
                <c:lineChart>
                  <c:ser>
                    <c:spPr>
                      <a:ln><a:solidFill><a:schemeClr val="accent2"/></a:solidFill></a:ln>
                    </c:spPr>
                    <c:cat><c:strRef><c:strCache>
                      <c:pt idx="0"><c:v>Q1</c:v></c:pt>
                      <c:pt idx="1"><c:v>Q2</c:v></c:pt>
                      <c:pt idx="2"><c:v>Q3</c:v></c:pt>
                    </c:strCache></c:strRef></c:cat>
                    <c:val><c:numRef><c:numCache>
                      <c:pt idx="0"><c:v>3</c:v></c:pt>
                      <c:pt idx="1"><c:v>7</c:v></c:pt>
                      <c:pt idx="2"><c:v>5</c:v></c:pt>
                    </c:numCache></c:numRef></c:val>
                  </c:ser>
                </c:lineChart>
              </c:plotArea>
            </c:chart>
          </c:chartSpace>`
        ),
      }
    );

    const result = await importPptxPackage(file);
    const lineSegments = result.elements.filter(
      (element: any) =>
        element.type === 'arrow-line' && element.strokeColor === '#C00000'
    );
    const markers = result.elements.filter(
      (element: any) =>
        element.shape === 'ellipse' && element.fill === '#C00000'
    );

    expect(lineSegments).toHaveLength(2);
    expect(markers).toHaveLength(3);
    expect(
      result.elements.some((element: any) => element.text === 'Trend')
    ).toBe(true);
    expect(result.elements.some((element: any) => element.text === 'Q2')).toBe(
      true
    );
    expect(result.elements.some((element: any) => element.text === '7')).toBe(
      true
    );
    expect(result.meta.unsupportedCount).toBe(0);
  });

  it('imports cached PowerPoint area charts as editable line segments and markers', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:graphicFrame>
            <p:nvGraphicFramePr><p:cNvPr id="8" name="Area Chart"/></p:nvGraphicFramePr>
            <p:xfrm><a:off x="0" y="0"/><a:ext cx="2857500" cy="1428750"/></p:xfrm>
            <a:graphic>
              <a:graphicData>
                <c:chart r:id="rId2"/>
              </a:graphicData>
            </a:graphic>
          </p:graphicFrame>
        </p:spTree></p:cSld>
      </p:sld>`,
      `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId2" Type="chart" Target="../charts/chart1.xml"/>
      </Relationships>`,
      {
        'ppt/_rels/presentation.xml.rels': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="slide" Target="slides/slide1.xml"/>
            <Relationship Id="rId2" Type="theme" Target="theme/theme1.xml"/>
          </Relationships>`
        ),
        'ppt/theme/theme1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Demo">
            <a:themeElements>
              <a:clrScheme name="Demo">
                <a:dk1><a:srgbClr val="000000"/></a:dk1>
                <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
                <a:accent1><a:srgbClr val="4472C4"/></a:accent1>
                <a:accent4><a:srgbClr val="FFC000"/></a:accent4>
              </a:clrScheme>
            </a:themeElements>
          </a:theme>`
        ),
        'ppt/charts/chart1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <c:chartSpace
            xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <c:chart>
              <c:title><c:tx><c:rich><a:p><a:r><a:t>Coverage</a:t></a:r></a:p></c:rich></c:tx></c:title>
              <c:plotArea>
                <c:areaChart>
                  <c:ser>
                    <c:spPr><a:solidFill><a:schemeClr val="accent4"/></a:solidFill></c:spPr>
                    <c:cat><c:strRef><c:strCache>
                      <c:pt idx="0"><c:v>Jan</c:v></c:pt>
                      <c:pt idx="1"><c:v>Feb</c:v></c:pt>
                      <c:pt idx="2"><c:v>Mar</c:v></c:pt>
                    </c:strCache></c:strRef></c:cat>
                    <c:val><c:numRef><c:numCache>
                      <c:pt idx="0"><c:v>4</c:v></c:pt>
                      <c:pt idx="1"><c:v>8</c:v></c:pt>
                      <c:pt idx="2"><c:v>6</c:v></c:pt>
                    </c:numCache></c:numRef></c:val>
                  </c:ser>
                </c:areaChart>
              </c:plotArea>
            </c:chart>
          </c:chartSpace>`
        ),
      }
    );

    const result = await importPptxPackage(file);
    const lineSegments = result.elements.filter(
      (element: any) =>
        element.type === 'arrow-line' && element.strokeColor === '#FFC000'
    );
    const markers = result.elements.filter(
      (element: any) =>
        element.shape === 'ellipse' && element.fill === '#FFC000'
    );

    expect(lineSegments).toHaveLength(2);
    expect(markers).toHaveLength(3);
    expect(
      result.elements.some((element: any) => element.text === 'Coverage')
    ).toBe(true);
    expect(result.elements.some((element: any) => element.text === 'Feb')).toBe(
      true
    );
    expect(result.elements.some((element: any) => element.text === '8')).toBe(
      true
    );
    expect(result.meta.unsupportedCount).toBe(0);
  });

  it('imports cached PowerPoint scatter charts as editable points and labels', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:graphicFrame>
            <p:nvGraphicFramePr><p:cNvPr id="5" name="Scatter Chart"/></p:nvGraphicFramePr>
            <p:xfrm><a:off x="0" y="0"/><a:ext cx="2857500" cy="1428750"/></p:xfrm>
            <a:graphic>
              <a:graphicData>
                <c:chart r:id="rId2"/>
              </a:graphicData>
            </a:graphic>
          </p:graphicFrame>
        </p:spTree></p:cSld>
      </p:sld>`,
      `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId2" Type="chart" Target="../charts/chart1.xml"/>
      </Relationships>`,
      {
        'ppt/_rels/presentation.xml.rels': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="slide" Target="slides/slide1.xml"/>
            <Relationship Id="rId2" Type="theme" Target="theme/theme1.xml"/>
          </Relationships>`
        ),
        'ppt/theme/theme1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Demo">
            <a:themeElements>
              <a:clrScheme name="Demo">
                <a:dk1><a:srgbClr val="000000"/></a:dk1>
                <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
                <a:accent1><a:srgbClr val="4472C4"/></a:accent1>
                <a:accent3><a:srgbClr val="7030A0"/></a:accent3>
              </a:clrScheme>
            </a:themeElements>
          </a:theme>`
        ),
        'ppt/charts/chart1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <c:chartSpace
            xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <c:chart>
              <c:title><c:tx><c:rich><a:p><a:r><a:t>Correlation</a:t></a:r></a:p></c:rich></c:tx></c:title>
              <c:plotArea>
                <c:scatterChart>
                  <c:scatterStyle val="lineMarker"/>
                  <c:ser>
                    <c:spPr>
                      <a:ln><a:solidFill><a:schemeClr val="accent3"/></a:solidFill></a:ln>
                    </c:spPr>
                    <c:xVal><c:numRef><c:numCache>
                      <c:pt idx="0"><c:v>1</c:v></c:pt>
                      <c:pt idx="1"><c:v>2</c:v></c:pt>
                      <c:pt idx="2"><c:v>5</c:v></c:pt>
                    </c:numCache></c:numRef></c:xVal>
                    <c:yVal><c:numRef><c:numCache>
                      <c:pt idx="0"><c:v>10</c:v></c:pt>
                      <c:pt idx="1"><c:v>20</c:v></c:pt>
                      <c:pt idx="2"><c:v>30</c:v></c:pt>
                    </c:numCache></c:numRef></c:yVal>
                  </c:ser>
                </c:scatterChart>
              </c:plotArea>
            </c:chart>
          </c:chartSpace>`
        ),
      }
    );

    const result = await importPptxPackage(file);
    const lineSegments = result.elements.filter(
      (element: any) =>
        element.type === 'arrow-line' && element.strokeColor === '#7030A0'
    );
    const markers = result.elements.filter(
      (element: any) =>
        element.shape === 'ellipse' && element.fill === '#7030A0'
    );

    expect(lineSegments).toHaveLength(2);
    expect(markers).toHaveLength(3);
    expect(
      result.elements.some((element: any) => element.text === 'Correlation')
    ).toBe(true);
    expect(result.elements.some((element: any) => element.text === '20')).toBe(
      true
    );
    expect(result.elements.some((element: any) => element.text === '5')).toBe(
      true
    );
    expect(result.meta.unsupportedCount).toBe(0);
  });

  it('imports cached PowerPoint bubble charts as editable scaled bubbles', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:graphicFrame>
            <p:nvGraphicFramePr><p:cNvPr id="9" name="Bubble Chart"/></p:nvGraphicFramePr>
            <p:xfrm><a:off x="0" y="0"/><a:ext cx="2857500" cy="1428750"/></p:xfrm>
            <a:graphic>
              <a:graphicData>
                <c:chart r:id="rId2"/>
              </a:graphicData>
            </a:graphic>
          </p:graphicFrame>
        </p:spTree></p:cSld>
      </p:sld>`,
      `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId2" Type="chart" Target="../charts/chart1.xml"/>
      </Relationships>`,
      {
        'ppt/_rels/presentation.xml.rels': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="slide" Target="slides/slide1.xml"/>
            <Relationship Id="rId2" Type="theme" Target="theme/theme1.xml"/>
          </Relationships>`
        ),
        'ppt/theme/theme1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Demo">
            <a:themeElements>
              <a:clrScheme name="Demo">
                <a:dk1><a:srgbClr val="000000"/></a:dk1>
                <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
                <a:accent1><a:srgbClr val="4472C4"/></a:accent1>
                <a:accent5><a:srgbClr val="5B9BD5"/></a:accent5>
              </a:clrScheme>
            </a:themeElements>
          </a:theme>`
        ),
        'ppt/charts/chart1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <c:chartSpace
            xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <c:chart>
              <c:title><c:tx><c:rich><a:p><a:r><a:t>Impact Map</a:t></a:r></a:p></c:rich></c:tx></c:title>
              <c:plotArea>
                <c:bubbleChart>
                  <c:ser>
                    <c:spPr><a:solidFill><a:schemeClr val="accent5"/></a:solidFill></c:spPr>
                    <c:xVal><c:numRef><c:numCache>
                      <c:pt idx="0"><c:v>1</c:v></c:pt>
                      <c:pt idx="1"><c:v>3</c:v></c:pt>
                      <c:pt idx="2"><c:v>5</c:v></c:pt>
                    </c:numCache></c:numRef></c:xVal>
                    <c:yVal><c:numRef><c:numCache>
                      <c:pt idx="0"><c:v>10</c:v></c:pt>
                      <c:pt idx="1"><c:v>20</c:v></c:pt>
                      <c:pt idx="2"><c:v>15</c:v></c:pt>
                    </c:numCache></c:numRef></c:yVal>
                    <c:bubbleSize><c:numRef><c:numCache>
                      <c:pt idx="0"><c:v>12</c:v></c:pt>
                      <c:pt idx="1"><c:v>40</c:v></c:pt>
                      <c:pt idx="2"><c:v>24</c:v></c:pt>
                    </c:numCache></c:numRef></c:bubbleSize>
                  </c:ser>
                </c:bubbleChart>
              </c:plotArea>
            </c:chart>
          </c:chartSpace>`
        ),
      }
    );

    const result = await importPptxPackage(file);
    const bubbles = result.elements.filter(
      (element: any) =>
        element.id.includes('-bubble-') &&
        element.shape === 'ellipse' &&
        element.fill === '#5B9BD5'
    );

    expect(bubbles).toHaveLength(3);
    expect(bubbles[1].points[1][0] - bubbles[1].points[0][0]).toBeGreaterThan(
      bubbles[0].points[1][0] - bubbles[0].points[0][0]
    );
    expect(
      result.elements.some((element: any) => element.text === 'Impact Map')
    ).toBe(true);
    expect(result.elements.some((element: any) => element.text === '40')).toBe(
      true
    );
    expect(result.elements.some((element: any) => element.text === '5')).toBe(
      true
    );
    expect(result.meta.unsupportedCount).toBe(0);
  });

  it('recovers text from pptx files with unescaped quotes in typeface attributes', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="2" name="Malformed Font"/></p:nvSpPr>
            <p:spPr>
              <a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="476250"/></a:xfrm>
            </p:spPr>
            <p:txBody>
              <a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0"/>
              <a:p>
                <a:r>
                  <a:rPr sz="1800"><a:latin typeface="Arial, sans-serif, "Segoe UI", "Helvetica Neue"" pitchFamily="34" charset="0"/></a:rPr>
                  <a:t>Malformed font still imports</a:t>
                </a:r>
              </a:p>
            </p:txBody>
          </p:sp>
        </p:spTree></p:cSld>
      </p:sld>`
    );

    const result = await importPptxPackage(file);

    expect(
      result.elements.some(
        (element: any) => element.text === 'Malformed font still imports'
      )
    ).toBe(true);
  });

  it('does not add visible rectangle shapes for text-only placeholders with empty line styles', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="2" name="Text Box"/></p:nvSpPr>
            <p:spPr>
              <a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="476250"/></a:xfrm>
              <a:prstGeom prst="rect"/>
              <a:noFill/>
              <a:ln/>
            </p:spPr>
            <p:txBody>
              <a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0"/>
              <a:p><a:r><a:rPr sz="1800"/><a:t>Only text</a:t></a:r></a:p>
            </p:txBody>
          </p:sp>
        </p:spTree></p:cSld>
      </p:sld>`
    );

    const result = await importPptxPackage(file);

    expect(
      result.elements.filter((element: any) => element.text === 'Only text')
    ).toHaveLength(1);
    expect(
      result.elements.some(
        (element: any) =>
          element.shape === 'rectangle' &&
          element.strokeColor !== '#d0d5dd' &&
          element.text === ''
      )
    ).toBe(false);
  });

  it('preserves slide tree layer order between pictures and later text', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:pic>
            <p:nvPicPr><p:cNvPr id="2" name="Image"/></p:nvPicPr>
            <p:blipFill><a:blip r:embed="rId2"/></p:blipFill>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="952500"/></a:xfrm></p:spPr>
          </p:pic>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="3" name="Text"/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="476250"/></a:xfrm><a:noFill/><a:ln/></p:spPr>
            <p:txBody>
              <a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0"/>
              <a:p><a:r><a:rPr sz="1800"/><a:t>Text above image</a:t></a:r></a:p>
            </p:txBody>
          </p:sp>
        </p:spTree></p:cSld>
      </p:sld>`,
      `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId2" Type="image" Target="../media/image1.png"/>
      </Relationships>`
    );

    const result = await importPptxPackage(file);
    const imageIndex = result.elements.findIndex(
      (element: any) => element.type === 'image'
    );
    const textIndex = result.elements.findIndex(
      (element: any) => element.text === 'Text above image'
    );

    expect(imageIndex).toBeGreaterThan(-1);
    expect(textIndex).toBeGreaterThan(imageIndex);
  });

  it('applies group transforms to nested editable elements', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:grpSp>
            <p:nvGrpSpPr><p:cNvPr id="2" name="Group"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
            <p:grpSpPr>
              <a:xfrm>
                <a:off x="952500" y="1905000"/>
                <a:ext cx="1905000" cy="952500"/>
                <a:chOff x="0" y="0"/>
                <a:chExt cx="952500" cy="476250"/>
              </a:xfrm>
            </p:grpSpPr>
            <p:sp>
              <p:nvSpPr><p:cNvPr id="3" name="Nested Box"/></p:nvSpPr>
              <p:spPr>
                <a:xfrm><a:off x="95250" y="95250"/><a:ext cx="190500" cy="95250"/></a:xfrm>
                <a:prstGeom prst="rect"/>
                <a:solidFill><a:srgbClr val="DAE8FC"/></a:solidFill>
                <a:ln><a:noFill/></a:ln>
              </p:spPr>
            </p:sp>
          </p:grpSp>
        </p:spTree></p:cSld>
      </p:sld>`
    );

    const result = await importPptxPackage(file);
    const shape = result.elements.find(
      (element: any) =>
        element.shape === 'rectangle' && element.fill === '#DAE8FC'
    ) as any;

    expect(shape.points).toEqual([
      [120, 220],
      [160, 240],
    ]);
  });

  it('expands imported text boxes enough for wrapped multi-line text', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="2" name="Text"/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="190500"/></a:xfrm><a:noFill/><a:ln/></p:spPr>
            <p:txBody>
              <a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0"/>
              <a:p><a:r><a:rPr sz="2400"/><a:t>First line</a:t></a:r></a:p>
              <a:p><a:r><a:rPr sz="2400"/><a:t>Second line</a:t></a:r></a:p>
            </p:txBody>
          </p:sp>
        </p:spTree></p:cSld>
      </p:sld>`
    );

    const result = await importPptxPackage(file);
    const text = result.elements.find(
      (element: any) => element.text === 'First line\nSecond line'
    ) as any;

    expect(text.points[1][1] - text.points[0][1]).toBeGreaterThan(20);
  });

  it('keeps explicit PowerPoint text line breaks editable', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="2" name="Broken Text"/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="285750"/></a:xfrm><a:noFill/><a:ln/></p:spPr>
            <p:txBody>
              <a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0"/>
              <a:p>
                <a:r><a:rPr sz="1800"/><a:t>First</a:t></a:r>
                <a:br/>
                <a:r><a:rPr sz="1800"/><a:t>Second</a:t></a:r>
              </a:p>
            </p:txBody>
          </p:sp>
        </p:spTree></p:cSld>
      </p:sld>`
    );

    const result = await importPptxPackage(file);

    expect(
      result.elements.some((element: any) => element.text === 'First\nSecond')
    ).toBe(true);
  });

  it('expands narrow text boxes for PowerPoint soft-wrapped lines', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="2" name="Soft Wrap Text"/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="476250" cy="190500"/></a:xfrm><a:noFill/><a:ln/></p:spPr>
            <p:txBody>
              <a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0"/>
              <a:p><a:r><a:rPr sz="1800"/><a:t>User natural language needs</a:t></a:r></a:p>
            </p:txBody>
          </p:sp>
        </p:spTree></p:cSld>
      </p:sld>`
    );

    const result = await importPptxPackage(file);
    const text = result.elements.find(
      (element: any) => element.text === 'User natural language needs'
    ) as any;

    expect(text.points).toEqual([
      [0, 0],
      [50, expect.any(Number)],
    ]);
    expect(text.points[1][1] - text.points[0][1]).toBeGreaterThan(34);
  });

  it('resolves theme colors for editable text and slide backgrounds', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld>
          <p:bg><p:bgPr><a:solidFill><a:schemeClr val="bg2"/></a:solidFill></p:bgPr></p:bg>
          <p:spTree>
            <p:sp>
              <p:nvSpPr><p:cNvPr id="2" name="Theme Text"/></p:nvSpPr>
              <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="476250"/></a:xfrm><a:noFill/><a:ln/></p:spPr>
              <p:txBody>
                <a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0"/>
                <a:p>
                  <a:r>
                    <a:rPr sz="1800"><a:solidFill><a:schemeClr val="accent2"/></a:solidFill></a:rPr>
                    <a:t>Theme color text</a:t>
                  </a:r>
                </a:p>
              </p:txBody>
            </p:sp>
          </p:spTree>
        </p:cSld>
      </p:sld>`,
      '',
      {
        'ppt/_rels/presentation.xml.rels': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="slide" Target="slides/slide1.xml"/>
            <Relationship Id="rId2" Type="theme" Target="theme/theme1.xml"/>
          </Relationships>`
        ),
        'ppt/theme/theme1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:themeElements>
              <a:clrScheme name="Office">
                <a:dk1><a:srgbClr val="000000"/></a:dk1>
                <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
                <a:dk2><a:srgbClr val="44546A"/></a:dk2>
                <a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>
                <a:accent1><a:srgbClr val="4472C4"/></a:accent1>
                <a:accent2><a:srgbClr val="ED7D31"/></a:accent2>
              </a:clrScheme>
            </a:themeElements>
          </a:theme>`
        ),
      }
    );

    const result = await importPptxPackage(file);
    const frame = result.elements.find(
      (element: any) => element.id === 'pptx-slide-1-frame'
    ) as any;
    const text = result.elements.find(
      (element: any) => element.text === 'Theme color text'
    ) as any;

    expect(frame.fill).toBe('#E7E6E6');
    expect(text.textStyle.color).toBe('#ED7D31');
  });

  it('applies PowerPoint slide color map overrides to theme colors', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld>
          <p:bg><p:bgPr><a:solidFill><a:schemeClr val="bg1"/></a:solidFill></p:bgPr></p:bg>
          <p:spTree>
            <p:sp>
              <p:nvSpPr><p:cNvPr id="2" name="Mapped Text"/></p:nvSpPr>
              <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="476250"/></a:xfrm><a:noFill/><a:ln/></p:spPr>
              <p:txBody>
                <a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0"/>
                <a:p><a:r><a:rPr sz="1800"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:rPr><a:t>Mapped theme text</a:t></a:r></a:p>
              </p:txBody>
            </p:sp>
          </p:spTree>
        </p:cSld>
        <p:clrMapOvr><a:overrideClrMapping bg1="dk1" tx1="lt1"/></p:clrMapOvr>
      </p:sld>`,
      '',
      {
        'ppt/_rels/presentation.xml.rels': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="slide" Target="slides/slide1.xml"/>
            <Relationship Id="rId2" Type="theme" Target="theme/theme1.xml"/>
          </Relationships>`
        ),
        'ppt/theme/theme1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:themeElements>
              <a:clrScheme name="Office">
                <a:dk1><a:srgbClr val="000000"/></a:dk1>
                <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
              </a:clrScheme>
            </a:themeElements>
          </a:theme>`
        ),
      }
    );

    const result = await importPptxPackage(file);
    const frame = result.elements.find(
      (element: any) => element.id === 'pptx-slide-1-frame'
    ) as any;
    const text = result.elements.find(
      (element: any) => element.text === 'Mapped theme text'
    ) as any;

    expect(frame.fill).toBe('#000000');
    expect(text.textStyle.color).toBe('#FFFFFF');
  });

  it('preserves text color opacity from PowerPoint alpha fills', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="2" name="Transparent Text"/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="476250"/></a:xfrm><a:noFill/><a:ln/></p:spPr>
            <p:txBody>
              <a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0"/>
              <a:p>
                <a:r>
                  <a:rPr sz="1800"><a:solidFill><a:srgbClr val="112233"><a:alpha val="50000"/></a:srgbClr></a:solidFill></a:rPr>
                  <a:t>Transparent text</a:t>
                </a:r>
              </a:p>
            </p:txBody>
          </p:sp>
        </p:spTree></p:cSld>
      </p:sld>`
    );

    const result = await importPptxPackage(file);
    const text = result.elements.find(
      (element: any) => element.text === 'Transparent text'
    ) as any;

    expect(text.textStyle.color).toBe('#112233');
    expect(text.textStyle.opacity).toBe(0.5);
    expect(text.textProperties.opacity).toBe('0.5');
  });

  it('imports multi-run text as native editable text instead of an image fragment', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="2" name="Rich Text"/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1905000" cy="476250"/></a:xfrm><a:noFill/><a:ln/></p:spPr>
            <p:txBody>
              <a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0"/>
              <a:p>
                <a:r>
                  <a:rPr sz="1800"><a:solidFill><a:srgbClr val="C00000"/></a:solidFill><a:latin typeface="Aptos"/></a:rPr>
                  <a:t>Red</a:t>
                </a:r>
                <a:r>
                  <a:rPr sz="1800" b="1"><a:solidFill><a:srgbClr val="00B050"/></a:solidFill><a:latin typeface="Aptos Narrow"/></a:rPr>
                  <a:t> Green</a:t>
                </a:r>
                <a:br/>
                <a:r>
                  <a:rPr sz="1800"><a:solidFill><a:srgbClr val="0070C0"/></a:solidFill><a:latin typeface="Aptos"/></a:rPr>
                  <a:t>Blue line</a:t>
                </a:r>
              </a:p>
            </p:txBody>
          </p:sp>
        </p:spTree></p:cSld>
      </p:sld>`
    );

    const result = await importPptxPackage(file);
    const text = result.elements.find(
      (element: any) => element.text === 'Red Green\nBlue line'
    ) as any;

    expect(text.type).toBe('geometry');
    expect(text.shape).toBe('text');
    expect(text.textStyle.fontFamily).toContain('Aptos');
    expect(text.textStyle.fontFamily).toContain('Aptos Narrow');
    expect(text.textStyle.color).toBe('#C00000');
    expect(text.points[0]).toEqual([0, 0]);
    expect(text.points[1][0]).toBe(200);
    expect(text.points[1][1]).toBeGreaterThan(50);
    expect(
      result.elements.some((element: any) => element.sceneImportMetadata)
    ).toBe(false);
  });

  it('inherits text color from paragraph default run properties', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="2" name="Inherited Text"/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="476250"/></a:xfrm><a:noFill/><a:ln/></p:spPr>
            <p:txBody>
              <a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0"/>
              <a:p>
                <a:pPr>
                  <a:defRPr sz="1800"><a:solidFill><a:schemeClr val="accent5"/></a:solidFill></a:defRPr>
                </a:pPr>
                <a:r><a:rPr sz="2400"/><a:t>Inherited color</a:t></a:r>
              </a:p>
            </p:txBody>
          </p:sp>
        </p:spTree></p:cSld>
      </p:sld>`,
      '',
      {
        'ppt/_rels/presentation.xml.rels': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="slide" Target="slides/slide1.xml"/>
            <Relationship Id="rId2" Type="theme" Target="theme/theme1.xml"/>
          </Relationships>`
        ),
        'ppt/theme/theme1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:themeElements>
              <a:clrScheme name="Office">
                <a:dk1><a:srgbClr val="000000"/></a:dk1>
                <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
                <a:accent5><a:srgbClr val="5B9BD5"/></a:accent5>
              </a:clrScheme>
            </a:themeElements>
          </a:theme>`
        ),
      }
    );

    const result = await importPptxPackage(file);
    const text = result.elements.find(
      (element: any) => element.text === 'Inherited color'
    ) as any;

    expect(text.textStyle.fontSize).toBe(32);
    expect(text.textStyle.color).toBe('#5B9BD5');
  });

  it('inherits placeholder text style from PowerPoint slide masters', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:sp>
            <p:nvSpPr>
              <p:cNvPr id="2" name="Title Placeholder"/>
              <p:cNvSpPr/>
              <p:nvPr><p:ph type="title"/></p:nvPr>
            </p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1905000" cy="476250"/></a:xfrm><a:noFill/><a:ln/></p:spPr>
            <p:txBody>
              <a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0"/>
              <a:p><a:r><a:t>Master styled title</a:t></a:r></a:p>
            </p:txBody>
          </p:sp>
        </p:spTree></p:cSld>
      </p:sld>`,
      `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="layout" Target="../slideLayouts/slideLayout1.xml"/>
      </Relationships>`,
      {
        'ppt/_rels/presentation.xml.rels': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="slide" Target="slides/slide1.xml"/>
            <Relationship Id="rId2" Type="theme" Target="theme/theme1.xml"/>
          </Relationships>`
        ),
        'ppt/theme/theme1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:themeElements>
              <a:clrScheme name="Office">
                <a:dk1><a:srgbClr val="000000"/></a:dk1>
                <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
                <a:accent1><a:srgbClr val="4472C4"/></a:accent1>
              </a:clrScheme>
            </a:themeElements>
          </a:theme>`
        ),
        'ppt/slideLayouts/slideLayout1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <p:sldLayout
            xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <p:cSld><p:spTree/></p:cSld>
          </p:sldLayout>`
        ),
        'ppt/slideLayouts/_rels/slideLayout1.xml.rels': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="master" Target="../slideMasters/slideMaster1.xml"/>
          </Relationships>`
        ),
        'ppt/slideMasters/slideMaster1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <p:sldMaster
            xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <p:cSld><p:spTree/></p:cSld>
            <p:txStyles>
              <p:titleStyle>
                <a:lvl1pPr algn="ctr">
                  <a:lnSpc><a:spcPct val="120000"/></a:lnSpc>
                  <a:defRPr sz="3200" b="1">
                    <a:solidFill><a:schemeClr val="accent1"/></a:solidFill>
                    <a:latin typeface="Aptos Display"/>
                  </a:defRPr>
                </a:lvl1pPr>
              </p:titleStyle>
              <p:bodyStyle/>
              <p:otherStyle/>
            </p:txStyles>
          </p:sldMaster>`
        ),
      }
    );

    const result = await importPptxPackage(file);
    const text = result.elements.find(
      (element: any) => element.text === 'Master styled title'
    ) as any;

    expect(text.textStyle.color).toBe('#4472C4');
    expect(text.textStyle.fontSize).toBeCloseTo(42.67, 1);
    expect(text.textStyle.align).toBe('center');
    expect(text.textStyle.fontFamily).toContain('Aptos Display');
    expect(text.textProperties.bold).toBe(true);
  });

  it('prefers matching slide layout placeholder text style over master defaults', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:sp>
            <p:nvSpPr>
              <p:cNvPr id="2" name="Layout Title Placeholder"/>
              <p:cNvSpPr/>
              <p:nvPr><p:ph type="title" idx="1"/></p:nvPr>
            </p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1905000" cy="476250"/></a:xfrm><a:noFill/><a:ln/></p:spPr>
            <p:txBody>
              <a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0"/>
              <a:p><a:r><a:t>Layout styled title</a:t></a:r></a:p>
            </p:txBody>
          </p:sp>
        </p:spTree></p:cSld>
      </p:sld>`,
      `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="layout" Target="../slideLayouts/slideLayout1.xml"/>
      </Relationships>`,
      {
        'ppt/_rels/presentation.xml.rels': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="slide" Target="slides/slide1.xml"/>
            <Relationship Id="rId2" Type="theme" Target="theme/theme1.xml"/>
          </Relationships>`
        ),
        'ppt/theme/theme1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:themeElements>
              <a:clrScheme name="Office">
                <a:dk1><a:srgbClr val="000000"/></a:dk1>
                <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
                <a:accent1><a:srgbClr val="4472C4"/></a:accent1>
                <a:accent2><a:srgbClr val="ED7D31"/></a:accent2>
              </a:clrScheme>
            </a:themeElements>
          </a:theme>`
        ),
        'ppt/slideLayouts/slideLayout1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <p:sldLayout
            xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <p:cSld><p:spTree>
              <p:sp>
                <p:nvSpPr>
                  <p:cNvPr id="3" name="Layout Title"/>
                  <p:cNvSpPr/>
                  <p:nvPr><p:ph type="title" idx="1"/></p:nvPr>
                </p:nvSpPr>
                <p:txBody>
                  <a:bodyPr/>
                  <a:p>
                    <a:pPr algn="r">
                      <a:defRPr sz="2800">
                        <a:solidFill><a:schemeClr val="accent2"/></a:solidFill>
                        <a:latin typeface="Aptos Narrow"/>
                      </a:defRPr>
                    </a:pPr>
                    <a:r><a:t>Layout sample</a:t></a:r>
                  </a:p>
                </p:txBody>
              </p:sp>
            </p:spTree></p:cSld>
          </p:sldLayout>`
        ),
        'ppt/slideLayouts/_rels/slideLayout1.xml.rels': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="master" Target="../slideMasters/slideMaster1.xml"/>
          </Relationships>`
        ),
        'ppt/slideMasters/slideMaster1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <p:sldMaster
            xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <p:cSld><p:spTree/></p:cSld>
            <p:txStyles>
              <p:titleStyle>
                <a:lvl1pPr algn="ctr">
                  <a:defRPr sz="3200">
                    <a:solidFill><a:schemeClr val="accent1"/></a:solidFill>
                    <a:latin typeface="Aptos Display"/>
                  </a:defRPr>
                </a:lvl1pPr>
              </p:titleStyle>
              <p:bodyStyle/>
              <p:otherStyle/>
            </p:txStyles>
          </p:sldMaster>`
        ),
      }
    );

    const result = await importPptxPackage(file);
    const text = result.elements.find(
      (element: any) => element.text === 'Layout styled title'
    ) as any;

    expect(text.textStyle.color).toBe('#ED7D31');
    expect(text.textStyle.fontSize).toBeCloseTo(37.33, 1);
    expect(text.textStyle.align).toBe('right');
    expect(text.textStyle.fontFamily).toContain('Aptos Narrow');
  });

  it('inherits placeholder shape fill and line style from PowerPoint layouts', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:sp>
            <p:nvSpPr>
              <p:cNvPr id="2" name="Body Placeholder"/>
              <p:cNvSpPr/>
              <p:nvPr><p:ph type="body" idx="2"/></p:nvPr>
            </p:nvSpPr>
            <p:spPr>
              <a:xfrm><a:off x="0" y="0"/><a:ext cx="1905000" cy="476250"/></a:xfrm>
              <a:prstGeom prst="roundRect"/>
            </p:spPr>
          </p:sp>
        </p:spTree></p:cSld>
      </p:sld>`,
      `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="layout" Target="../slideLayouts/slideLayout1.xml"/>
      </Relationships>`,
      {
        'ppt/slideLayouts/slideLayout1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <p:sldLayout
            xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <p:cSld><p:spTree>
              <p:sp>
                <p:nvSpPr>
                  <p:cNvPr id="3" name="Layout Body"/>
                  <p:cNvSpPr/>
                  <p:nvPr><p:ph type="body" idx="2"/></p:nvPr>
                </p:nvSpPr>
                <p:spPr>
                  <a:prstGeom prst="roundRect"/>
                  <a:solidFill><a:srgbClr val="D9EAD3"/></a:solidFill>
                  <a:ln w="19050"><a:solidFill><a:srgbClr val="38761D"/></a:solidFill></a:ln>
                </p:spPr>
              </p:sp>
            </p:spTree></p:cSld>
          </p:sldLayout>`
        ),
      }
    );

    const result = await importPptxPackage(file);
    const shape = result.elements.find(
      (element: any) =>
        element.id !== 'pptx-slide-1-frame' &&
        element.shape === 'roundRectangle'
    ) as any;

    expect(shape.fill).toBe('#D9EAD3');
    expect(shape.strokeColor).toBe('#38761D');
    expect(shape.strokeWidth).toBe(2);
  });

  it('uses PowerPoint style refs when shape fill and line colors are inherited', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="2" name="Styled Box"/></p:nvSpPr>
            <p:spPr>
              <a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="476250"/></a:xfrm>
              <a:prstGeom prst="rect"/>
              <a:ln/>
            </p:spPr>
            <p:style>
              <a:lnRef idx="1"><a:schemeClr val="accent1"/></a:lnRef>
              <a:fillRef idx="1"><a:schemeClr val="accent2"/></a:fillRef>
            </p:style>
          </p:sp>
        </p:spTree></p:cSld>
      </p:sld>`,
      '',
      {
        'ppt/_rels/presentation.xml.rels': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="slide" Target="slides/slide1.xml"/>
            <Relationship Id="rId2" Type="theme" Target="theme/theme1.xml"/>
          </Relationships>`
        ),
        'ppt/theme/theme1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:themeElements>
              <a:clrScheme name="Office">
                <a:dk1><a:srgbClr val="000000"/></a:dk1>
                <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
                <a:dk2><a:srgbClr val="44546A"/></a:dk2>
                <a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>
                <a:accent1><a:srgbClr val="4472C4"/></a:accent1>
                <a:accent2><a:srgbClr val="ED7D31"/></a:accent2>
              </a:clrScheme>
            </a:themeElements>
          </a:theme>`
        ),
      }
    );

    const result = await importPptxPackage(file);
    const shape = result.elements.find(
      (element: any) =>
        element.id !== 'pptx-slide-1-frame' &&
        element.shape === 'rectangle' &&
        element.text === ''
    ) as any;

    expect(shape.fill).toBe('#ED7D31');
    expect(shape.strokeColor).toBe('#4472C4');
  });

  it('resolves slide background references from theme colors', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld>
          <p:bg><p:bgRef idx="1001"><a:schemeClr val="accent6"/></p:bgRef></p:bg>
          <p:spTree/>
        </p:cSld>
      </p:sld>`,
      '',
      {
        'ppt/_rels/presentation.xml.rels': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="slide" Target="slides/slide1.xml"/>
            <Relationship Id="rId2" Type="theme" Target="theme/theme1.xml"/>
          </Relationships>`
        ),
        'ppt/theme/theme1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:themeElements>
              <a:clrScheme name="Office">
                <a:dk1><a:srgbClr val="000000"/></a:dk1>
                <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
                <a:accent6><a:srgbClr val="70AD47"/></a:accent6>
              </a:clrScheme>
            </a:themeElements>
          </a:theme>`
        ),
      }
    );

    const result = await importPptxPackage(file);
    const frame = result.elements.find(
      (element: any) => element.id === 'pptx-slide-1-frame'
    ) as any;

    expect(frame.fill).toBe('#70AD47');
  });

  it('imports slide picture backgrounds as full-slide image elements', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld>
          <p:bg><p:bgPr><a:blipFill><a:blip r:embed="rId2"/></a:blipFill></p:bgPr></p:bg>
          <p:spTree/>
        </p:cSld>
      </p:sld>`,
      `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId2" Type="image" Target="../media/image1.png"/>
      </Relationships>`
    );

    const result = await importPptxPackage(file);
    const frame = result.elements.find(
      (element: any) => element.id === 'pptx-slide-1-frame'
    ) as any;
    const image = result.elements.find(
      (element: any) => element.id === 'pptx-slide-1-background-image'
    ) as any;

    expect(frame.fill).toBe('#ffffff');
    expect(image.type).toBe('image');
    expect(image.points).toEqual([
      [0, 0],
      [960, 540],
    ]);
    expect(result.meta.assetCount).toBe(1);
    expect(result.meta.unsupportedCount).toBe(0);
  });

  it('inherits slide background from the PowerPoint layout when the slide has none', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree/></p:cSld>
      </p:sld>`,
      `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="layout" Target="../slideLayouts/slideLayout1.xml"/>
      </Relationships>`,
      {
        'ppt/slideLayouts/slideLayout1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <p:sldLayout
            xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="ABCDEF"/></a:solidFill></p:bgPr></p:bg></p:cSld>
          </p:sldLayout>`
        ),
      }
    );

    const result = await importPptxPackage(file);
    const frame = result.elements.find(
      (element: any) => element.id === 'pptx-slide-1-frame'
    ) as any;

    expect(frame.fill).toBe('#ABCDEF');
  });

  it('inherits picture backgrounds from the PowerPoint layout', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree/></p:cSld>
      </p:sld>`,
      `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="layout" Target="../slideLayouts/slideLayout1.xml"/>
      </Relationships>`,
      {
        'ppt/slideLayouts/slideLayout1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <p:sldLayout
            xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
            <p:cSld>
              <p:bg><p:bgPr><a:blipFill><a:blip r:embed="rId2"/></a:blipFill></p:bgPr></p:bg>
              <p:spTree/>
            </p:cSld>
          </p:sldLayout>`
        ),
        'ppt/slideLayouts/_rels/slideLayout1.xml.rels': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId2" Type="image" Target="../media/image1.png"/>
          </Relationships>`
        ),
      }
    );

    const result = await importPptxPackage(file);
    const image = result.elements.find(
      (element: any) => element.id === 'pptx-slide-1-background-image-layout'
    ) as any;

    expect(image.type).toBe('image');
    expect(image.points).toEqual([
      [0, 0],
      [960, 540],
    ]);
    expect(result.meta.assetCount).toBe(1);
    expect(result.meta.unsupportedCount).toBe(0);
  });

  it('inherits slide background from the PowerPoint master through layout', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree/></p:cSld>
      </p:sld>`,
      `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="layout" Target="../slideLayouts/slideLayout1.xml"/>
      </Relationships>`,
      {
        'ppt/slideLayouts/slideLayout1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <p:sldLayout
            xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <p:cSld><p:spTree/></p:cSld>
          </p:sldLayout>`
        ),
        'ppt/slideLayouts/_rels/slideLayout1.xml.rels': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="master" Target="../slideMasters/slideMaster1.xml"/>
          </Relationships>`
        ),
        'ppt/slideMasters/slideMaster1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <p:sldMaster
            xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FCE4D6"/></a:solidFill></p:bgPr></p:bg></p:cSld>
          </p:sldMaster>`
        ),
      }
    );

    const result = await importPptxPackage(file);
    const frame = result.elements.find(
      (element: any) => element.id === 'pptx-slide-1-frame'
    ) as any;

    expect(frame.fill).toBe('#FCE4D6');
  });

  it('inherits picture backgrounds from the PowerPoint master through layout', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree/></p:cSld>
      </p:sld>`,
      `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="layout" Target="../slideLayouts/slideLayout1.xml"/>
      </Relationships>`,
      {
        'ppt/slideLayouts/slideLayout1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <p:sldLayout
            xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <p:cSld><p:spTree/></p:cSld>
          </p:sldLayout>`
        ),
        'ppt/slideLayouts/_rels/slideLayout1.xml.rels': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="master" Target="../slideMasters/slideMaster1.xml"/>
          </Relationships>`
        ),
        'ppt/slideMasters/slideMaster1.xml': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <p:sldMaster
            xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
            <p:cSld>
              <p:bg><p:bgPr><a:blipFill><a:blip r:embed="rId2"/></a:blipFill></p:bgPr></p:bg>
              <p:spTree/>
            </p:cSld>
          </p:sldMaster>`
        ),
        'ppt/slideMasters/_rels/slideMaster1.xml.rels': encodeUtf8(
          `<?xml version="1.0" encoding="UTF-8"?>
          <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId2" Type="image" Target="../media/image1.png"/>
          </Relationships>`
        ),
      }
    );

    const result = await importPptxPackage(file);
    const image = result.elements.find(
      (element: any) => element.id === 'pptx-slide-1-background-image-master'
    ) as any;

    expect(image.type).toBe('image');
    expect(image.points).toEqual([
      [0, 0],
      [960, 540],
    ]);
    expect(result.meta.assetCount).toBe(1);
    expect(result.meta.unsupportedCount).toBe(0);
  });

  it('imports PowerPoint line arrow markers as editable connector markers', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="2" name="Arrow"/></p:nvSpPr>
            <p:spPr>
              <a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="952500"/></a:xfrm>
              <a:prstGeom prst="line"/>
              <a:ln w="9525">
                <a:solidFill><a:srgbClr val="334155"/></a:solidFill>
                <a:tailEnd type="triangle"/>
              </a:ln>
            </p:spPr>
          </p:sp>
        </p:spTree></p:cSld>
      </p:sld>`
    );

    const result = await importPptxPackage(file);
    const arrow = result.elements.find(
      (element: any) => element.type === 'arrow-line'
    ) as any;

    expect(arrow.target.marker).toBe('arrow');
    expect(arrow.source.marker).toBe('none');
  });

  it('preserves flipped line direction for editable connectors', async () => {
    const file = buildPptxFile(
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld><p:spTree>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="2" name="Flipped Arrow"/></p:nvSpPr>
            <p:spPr>
              <a:xfrm flipH="1"><a:off x="0" y="0"/><a:ext cx="952500" cy="476250"/></a:xfrm>
              <a:prstGeom prst="line"/>
              <a:ln w="9525"><a:solidFill><a:srgbClr val="334155"/></a:solidFill></a:ln>
            </p:spPr>
          </p:sp>
        </p:spTree></p:cSld>
      </p:sld>`
    );

    const result = await importPptxPackage(file);
    const line = result.elements.find(
      (element: any) => element.type === 'arrow-line'
    ) as any;

    expect(line.points).toEqual([
      [100, 0],
      [0, 50],
    ]);
  });
});
