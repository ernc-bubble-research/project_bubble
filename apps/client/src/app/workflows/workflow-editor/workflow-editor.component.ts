import { Component, AfterViewInit, ViewChild, ElementRef, Injector } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NodeEditor, GetSchemes, ClassicPreset } from 'rete';
import { AreaPlugin, AreaExtensions } from 'rete-area-plugin';
import { ConnectionPlugin, Presets as ConnectionPresets } from 'rete-connection-plugin';
import { AngularPlugin, Presets as AngularPresets } from 'rete-angular-plugin';

type Schemes = GetSchemes<ClassicPreset.Node, ClassicPreset.Connection<ClassicPreset.Node, ClassicPreset.Node>>;

@Component({
    selector: 'app-workflow-editor',
    standalone: true,
    imports: [CommonModule],
    template: `<div class="rete" #rete></div>`,
    styles: [`
    .rete {
      width: 100%;
      height: 100%;
      flex-grow: 1;
    }
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
  `]
})
export class WorkflowEditorComponent implements AfterViewInit {
    @ViewChild('rete') container!: ElementRef;

    constructor(private injector: Injector) { }

    async ngAfterViewInit() {
        const container = this.container.nativeElement;

        const editor = new NodeEditor<Schemes>();
        const area = new AreaPlugin<Schemes, any>(container);
        const connection = new ConnectionPlugin<Schemes, any>();
        const angularRender = new AngularPlugin<Schemes, any>({ injector: this.injector });

        connection.addPreset(ConnectionPresets.classic.setup());
        angularRender.addPreset(AngularPresets.classic.setup());

        editor.use(area);
        area.use(connection);
        area.use(angularRender);

        AreaExtensions.simpleNodesOrder(area);
        AreaExtensions.selectableNodes(area, AreaExtensions.selector(), { accumulating: AreaExtensions.accumulateOnCtrl() });

        // Mock Data
        const node1 = new ClassicPreset.Node('Agent A');
        const node2 = new ClassicPreset.Node('Tool B');
        node1.addOutput('o1', new ClassicPreset.Output(connection, 'Output'));
        node2.addInput('i1', new ClassicPreset.Input(connection, 'Input'));

        await editor.addNode(node1);
        await editor.addNode(node2);

        await area.translate(node1.id, { x: 50, y: 50 });
        await area.translate(node2.id, { x: 300, y: 50 });

        await editor.addConnection(new ClassicPreset.Connection(node1, 'o1', node2, 'i1'));
    }
}
