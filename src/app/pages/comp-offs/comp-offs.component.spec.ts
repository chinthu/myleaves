import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompOffsComponent } from './comp-offs.component';

describe('CompOffsComponent', () => {
  let component: CompOffsComponent;
  let fixture: ComponentFixture<CompOffsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompOffsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CompOffsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
