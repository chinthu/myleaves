import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PublicHolidaysComponent } from './public-holidays.component';

describe('PublicHolidaysComponent', () => {
  let component: PublicHolidaysComponent;
  let fixture: ComponentFixture<PublicHolidaysComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublicHolidaysComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PublicHolidaysComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
